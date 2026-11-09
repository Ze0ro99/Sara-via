'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('Node runtime matches the CommonJS server and route modules', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.type, 'commonjs');
  assert.match(read('server.js'), /module\.exports\s*=\s*app/);
});

test('Pi payment frontend fails closed and waits for server completion', () => {
  const app = read('app.js');
  assert.doesNotMatch(app, /Bypassing remote server approval/);
  assert.match(app, /\/api\/payments\/approve/);
  assert.match(app, /\/api\/payments\/complete/);
  assert.match(app, /payload\.completed/);
  assert.match(app, /verifiedByServer:\s*true/);
  assert.match(app, /querySelectorAll/);
  assert.doesNotMatch(read('index.html'), /onclick="connectPi\(\)"/);
});

test('travel providers are server-side and disabled when credentials are absent', () => {
  const route = read('routes/travel.js');
  assert.match(route, /AMADEUS_CLIENT_SECRET/);
  assert.match(route, /GOOGLE_ROUTES_API_KEY/);
  assert.match(route, /HOTEL_PROVIDER_API_KEY/);
  assert.match(route, /CRUISE_PROVIDER_API_KEY/);
  assert.match(route, /TOUR_PROVIDER_API_KEY/);
  assert.match(route, /LOGISTICS_PROVIDER_API_KEY/);
  assert.match(route, /retrievedAt/);
});

test('booking intents require verified Pi identity and server-only database credentials', () => {
  const route = read('routes/bookings.js');
  assert.match(route, /Authorization: 'Bearer '/);
  assert.match(route, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(route, /awaiting_provider_validation/);
  assert.doesNotMatch(read('app.js'), /SUPABASE_SERVICE_ROLE_KEY/);
});

test('Netlify routes API traffic before the SPA fallback', () => {
  const config = read('netlify.toml');
  assert.ok(config.indexOf('from = "/api/*"') < config.indexOf('from = "/*"'));
  assert.match(config, /functions = "netlify\/functions"/);
});
