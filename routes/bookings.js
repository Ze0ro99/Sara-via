'use strict';

const express = require('express');
const router = express.Router();
const PI_API_BASE = process.env.PI_API_BASE || 'https://api.minepi.com/v2';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function fail(res, status, code, error) { return res.status(status).json({ success: false, code, error }); }
async function readJson(response) { return response.json().catch(() => ({})); }
async function verifiedPiUser(req, res) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) { fail(res, 401, 'PI_AUTH_REQUIRED', 'Pi access token is required.'); return null; }
  const token = auth.slice(7).trim();
  if (!token || token.length > 4000) { fail(res, 401, 'PI_AUTH_INVALID', 'Pi access token is invalid.'); return null; }
  try {
    const response = await fetch(PI_API_BASE + '/me', { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
    const user = await readJson(response);
    if (!response.ok || !user.uid) { fail(res, 401, 'PI_AUTH_REJECTED', 'Pi identity could not be verified.'); return null; }
    return user;
  } catch { fail(res, 503, 'PI_AUTH_UNAVAILABLE', 'Pi identity service is unavailable.'); return null; }
}
function databaseReady(res) {
  if (!SUPABASE_URL || !SUPABASE_KEY) { fail(res, 503, 'BOOKING_DATABASE_NOT_CONFIGURED', 'Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable persistent booking intents.'); return false; }
  return true;
}
async function dbRequest(path, method, body) {
  const base = SUPABASE_URL.replace(/\/$/, '');
  const response = await fetch(base + '/rest/v1/' + path, { method, headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Accept: 'application/json', Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const data = await readJson(response);
  if (!response.ok) { const error = new Error(data.message || 'Booking database request failed.'); error.status = response.status; throw error; }
  return data;
}

router.post('/intents', async (req, res) => {
  if (!databaseReady(res)) return;
  const user = await verifiedPiUser(req, res); if (!user) return;
  const { category, provider, offerReference, offerSnapshot = {} } = req.body || {};
  if (!['flights', 'hotels', 'cruises', 'tours', 'transfer'].includes(category)) return fail(res, 400, 'INVALID_BOOKING_CATEGORY', 'Unsupported booking category.');
  if (typeof provider !== 'string' || !provider.trim() || provider.length > 100 || typeof offerReference !== 'string' || !offerReference.trim() || offerReference.length > 300) return fail(res, 400, 'INVALID_OFFER_REFERENCE', 'Provider and offerReference are required.');
  if (!offerSnapshot || typeof offerSnapshot !== 'object' || Array.isArray(offerSnapshot) || JSON.stringify(offerSnapshot).length > 12000) return fail(res, 400, 'INVALID_OFFER_SNAPSHOT', 'offerSnapshot must be a JSON object under 12 KB.');
  try {
    const rows = await dbRequest('booking_intents?select=*', 'POST', { pi_uid: user.uid, category, provider: provider.trim(), offer_reference: offerReference.trim(), offer_snapshot: offerSnapshot, status: 'awaiting_provider_validation' });
    return res.status(201).json({ success: true, intent: rows[0], message: 'Intent saved. This is not a reservation; provider validation and confirmation are still required.' });
  } catch (error) { return fail(res, error.status || 502, 'BOOKING_INTENT_CREATE_FAILED', error.message); }
});

router.get('/intents/:id', async (req, res) => {
  if (!databaseReady(res)) return;
  const user = await verifiedPiUser(req, res); if (!user) return;
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return fail(res, 400, 'INVALID_INTENT_ID', 'Booking intent ID is invalid.');
  try {
    const rows = await dbRequest('booking_intents?id=eq.' + encodeURIComponent(req.params.id) + '&pi_uid=eq.' + encodeURIComponent(user.uid) + '&select=*', 'GET');
    if (!rows.length) return fail(res, 404, 'BOOKING_INTENT_NOT_FOUND', 'Booking intent was not found.');
    return res.json({ success: true, intent: rows[0] });
  } catch (error) { return fail(res, error.status || 502, 'BOOKING_INTENT_READ_FAILED', error.message); }
});

router.post('/intents/:id/cancel', async (req, res) => {
  if (!databaseReady(res)) return;
  const user = await verifiedPiUser(req, res); if (!user) return;
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return fail(res, 400, 'INVALID_INTENT_ID', 'Booking intent ID is invalid.');
  try {
    const rows = await dbRequest('booking_intents?id=eq.' + encodeURIComponent(req.params.id) + '&pi_uid=eq.' + encodeURIComponent(user.uid) + '&status=eq.awaiting_provider_validation', 'PATCH', { status: 'cancelled', cancelled_at: new Date().toISOString() });
    if (!rows.length) return fail(res, 409, 'BOOKING_INTENT_NOT_CANCELLABLE', 'Intent was not found or is no longer cancellable.');
    return res.json({ success: true, intent: rows[0] });
  } catch (error) { return fail(res, error.status || 502, 'BOOKING_INTENT_CANCEL_FAILED', error.message); }
});

module.exports = router;
