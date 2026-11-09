'use strict';

const express = require('express');
const router = express.Router();

const AMADEUS_BASE = process.env.AMADEUS_BASE_URL || 'https://test.api.amadeus.com';
const GOOGLE_ROUTES_KEY = process.env.GOOGLE_ROUTES_API_KEY || '';
const GOOGLE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
let tokenCache = { value: null, expiresAt: 0 };
const genericProviders = {
  hotels: { base: process.env.HOTEL_PROVIDER_BASE_URL, key: process.env.HOTEL_PROVIDER_API_KEY },
  cruises: { base: process.env.CRUISE_PROVIDER_BASE_URL, key: process.env.CRUISE_PROVIDER_API_KEY },
  tours: { base: process.env.TOUR_PROVIDER_BASE_URL, key: process.env.TOUR_PROVIDER_API_KEY },
  logistics: { base: process.env.LOGISTICS_PROVIDER_BASE_URL, key: process.env.LOGISTICS_PROVIDER_API_KEY }
};
async function callGenericProvider(type, action, payload) {
  const provider = genericProviders[type];
  if (!provider?.base || !provider?.key) { const e = new Error(type + ' provider is not configured. Set its server-side base URL and API key.'); e.status = 503; throw e; }
  const base = new URL(provider.base);
  if (base.protocol !== 'https:') { const e = new Error('Provider URL must use HTTP(S).'); e.status = 500; throw e; }
  const response = await fetch(new URL('/' + action, base), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + provider.key, Accept: 'application/json' }, body: JSON.stringify(payload || {}) });
  return json(response);
}


function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error(name + ' is required.'); error.status = 400; throw error;
  }
  return value.trim();
}
async function json(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data?.errors?.[0]?.detail || data?.error_description || 'Provider request failed.'); error.status = response.status; throw error; }
  return data;
}
async function amadeusToken() {
  const id = process.env.AMADEUS_CLIENT_ID, secret = process.env.AMADEUS_CLIENT_SECRET;
  if (!id || !secret) { const e = new Error('Flight provider is not configured. Add AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET.'); e.status = 503; throw e; }
  if (tokenCache.value && tokenCache.expiresAt > Date.now() + 30000) return tokenCache.value;
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret });
  const response = await fetch(AMADEUS_BASE + '/v1/security/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const data = await json(response);
  tokenCache = { value: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 0) * 1000 };
  return tokenCache.value;
}

router.get('/status', (req, res) => res.json({ success: true, environment: 'testnet', providers: { flights: Boolean(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET), maps: Boolean(GOOGLE_ROUTES_KEY), hotels: Boolean(genericProviders.hotels.base && genericProviders.hotels.key), cruises: Boolean(genericProviders.cruises.base && genericProviders.cruises.key), tours: Boolean(genericProviders.tours.base && genericProviders.tours.key), logistics: Boolean(genericProviders.logistics.base && genericProviders.logistics.key) }, note: 'Unconfigured providers are disabled; no demo inventory is presented as live.' }));

router.post('/flights/search', async (req, res) => {
  try {
    const originLocationCode = required(req.body?.origin, 'origin').toUpperCase();
    const destinationLocationCode = required(req.body?.destination, 'destination').toUpperCase();
    const departureDate = required(req.body?.departureDate, 'departureDate');
    if (!/^[A-Z]{3}$/.test(originLocationCode) || !/^[A-Z]{3}$/.test(destinationLocationCode)) return res.status(400).json({ success: false, error: 'Use valid three-letter IATA airport codes.' });
    const parsedDate = new Date(departureDate + 'T00:00:00.000Z');
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(departureDate) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== departureDate || departureDate < new Date().toISOString().slice(0, 10)) return res.status(400).json({ success: false, error: 'departureDate must be a valid future date (YYYY-MM-DD).' });
    const adults = Math.min(9, Math.max(1, Number(req.body?.adults) || 1));
    const token = await amadeusToken();
    const query = new URLSearchParams({ originLocationCode, destinationLocationCode, departureDate, adults: String(adults), currencyCode: 'USD', max: '20' });
    const data = await json(await fetch(AMADEUS_BASE + '/v2/shopping/flight-offers?' + query, { headers: { Authorization: 'Bearer ' + token } }));
    return res.json({ success: true, provider: 'Amadeus Test API', retrievedAt: new Date().toISOString(), currency: data.meta?.currency || 'USD', results: data.data || [] });
  } catch (error) { return res.status(error.status || 502).json({ success: false, code: 'FLIGHT_SEARCH_FAILED', error: error.message }); }
});

router.post('/routes/compute', async (req, res) => {
  if (!GOOGLE_ROUTES_KEY) return res.status(503).json({ success: false, code: 'MAPS_PROVIDER_NOT_CONFIGURED', error: 'Configure GOOGLE_ROUTES_API_KEY to enable route calculations.' });
  try {
    const origin = req.body?.origin, destination = req.body?.destination;
    if (!origin || !destination || typeof origin !== 'object' || typeof destination !== 'object') return res.status(400).json({ success: false, error: 'origin and destination must be location objects.' });
    const response = await fetch(GOOGLE_ROUTES_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_ROUTES_KEY, 'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction' }, body: JSON.stringify({ origin, destination, travelMode: req.body?.travelMode || 'DRIVE', routingPreference: 'TRAFFIC_AWARE' }) });
    const data = await json(response);
    return res.json({ success: true, provider: 'Google Routes API', retrievedAt: new Date().toISOString(), routes: data.routes || [] });
  } catch (error) { return res.status(error.status || 502).json({ success: false, code: 'ROUTE_COMPUTE_FAILED', error: error.message }); }
});


router.post('/providers/:type/search', async (req, res) => {
  const type = req.params.type;
  if (!['hotels', 'tours', 'cruises'].includes(type)) return res.status(404).json({ success: false, error: 'Unknown inventory provider.' });
  try {
    const data = await callGenericProvider(type, 'search', req.body);
    return res.json({ success: true, provider: type, retrievedAt: new Date().toISOString(), results: data.results || data.data || data });
  } catch (error) { return res.status(error.status || 502).json({ success: false, code: type.toUpperCase() + '_SEARCH_FAILED', error: error.message }); }
});
router.post('/providers/logistics/quote', async (req, res) => {
  try { const data = await callGenericProvider('logistics', 'quote', req.body); return res.json({ success: true, provider: 'logistics', retrievedAt: new Date().toISOString(), quote: data.quote || data }); }
  catch (error) { return res.status(error.status || 502).json({ success: false, code: 'LOGISTICS_QUOTE_FAILED', error: error.message }); }
});
router.post('/providers/logistics/track', async (req, res) => {
  try { const trackingNumber = required(req.body?.trackingNumber, 'trackingNumber'); const data = await callGenericProvider('logistics', 'track', { trackingNumber }); return res.json({ success: true, provider: 'logistics', retrievedAt: new Date().toISOString(), tracking: data.tracking || data }); }
  catch (error) { return res.status(error.status || 502).json({ success: false, code: 'LOGISTICS_TRACK_FAILED', error: error.message }); }
});

module.exports = router;
