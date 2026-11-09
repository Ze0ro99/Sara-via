'use strict';

const express = require('express');
const router = express.Router();
const PI_API_BASE = process.env.PI_API_BASE || 'https://api.minepi.com/v2';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const allowedTypes = ['airline', 'hotel', 'cruise', 'tour_operator', 'transfer', 'logistics'];
const fail = (res, status, code, error) => res.status(status).json({ success: false, code, error });
async function readJson(response) { return response.json().catch(() => ({})); }

async function authenticatePi(req, res) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) { fail(res, 401, 'PI_AUTH_REQUIRED', 'Connect Pi before submitting a provider application.'); return null; }
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
  let secure = false; try { secure = new URL(SUPABASE_URL).protocol === 'https:'; } catch {}
  if (!secure || !SUPABASE_KEY) { fail(res, 503, 'PROVIDER_DATABASE_NOT_CONFIGURED', 'Provider registration requires the configured Supabase service connection.'); return false; }
  return true;
}
async function db(path, method, body) {
  const response = await fetch(SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path, {
    method, headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', Accept: 'application/json', Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await readJson(response);
  if (!response.ok) { const error = new Error(data.message || 'Provider database request failed.'); error.status = response.status; throw error; }
  return data;
}
function validText(value, max) { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max; }
function validEmail(value) { return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; }
function validHttpsUrl(value) { if (!value) return true; try { return new URL(value).protocol === 'https:'; } catch { return false; } }

router.post('/applications', async (req, res) => {
  if (!databaseReady(res)) return;
  const user = await authenticatePi(req, res); if (!user) return;
  const body = req.body || {};
  const legalName = typeof body.legalName === 'string' ? body.legalName.trim() : '';
  const serviceType = body.serviceType;
  const countryCode = typeof body.countryCode === 'string' ? body.countryCode.trim().toUpperCase() : '';
  const contactEmail = typeof body.contactEmail === 'string' ? body.contactEmail.trim() : '';
  const websiteUrl = typeof body.websiteUrl === 'string' ? body.websiteUrl.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (!validText(legalName, 180) || !allowedTypes.includes(serviceType) || !/^[A-Z]{2}$/.test(countryCode) || !validEmail(contactEmail) || !validText(description, 2000) || !validHttpsUrl(websiteUrl)) {
    return fail(res, 400, 'PROVIDER_APPLICATION_INVALID', 'Provide a legal business name, supported service type, ISO 3166-1 alpha-2 country code, valid email, description and optional HTTPS website.');
  }
  // API keys, wallet seeds, passwords and webhook secrets are deliberately not accepted here.
  try {
    const rows = await db('service_provider_applications?select=*', 'POST', {
      pi_uid: user.uid, legal_name: legalName, service_type: serviceType, country_code: countryCode,
      contact_email: contactEmail, website_url: websiteUrl || null, description,
      status: 'pending_review'
    });
    return res.status(201).json({ success: true, application: rows[0], message: 'Application submitted for review. Do not send API keys or wallet secrets in this form.' });
  } catch (error) {
    if (error.status === 409 || error.status === 23505) return fail(res, 409, 'PROVIDER_APPLICATION_EXISTS', 'A provider application already exists for this account and service type.');
    return fail(res, error.status || 502, 'PROVIDER_APPLICATION_FAILED', error.message);
  }
});

router.get('/applications/me', async (req, res) => {
  if (!databaseReady(res)) return;
  const user = await authenticatePi(req, res); if (!user) return;
  try {
    const rows = await db('service_provider_applications?pi_uid=eq.' + encodeURIComponent(user.uid) + '&select=id,legal_name,service_type,country_code,contact_email,website_url,description,status,created_at&order=created_at.desc', 'GET');
    return res.json({ success: true, applications: rows });
  } catch (error) { return fail(res, error.status || 502, 'PROVIDER_APPLICATION_READ_FAILED', error.message); }
});

module.exports = router;
