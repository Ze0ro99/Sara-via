# Testnet implementation and verification plan

## Release boundary

All current payment and provider flows must remain on Pi Testnet and provider sandbox/test endpoints. No Mainnet API URL, production secret, token claim, live booking claim, or automatic payout should be enabled by this branch.

## Workstream acceptance criteria

### Pi identity and payments
- [x] Authenticate with Pi SDK and verify the access token on the server.
- [x] Keep the Server API Key on the server only.
- [x] Fail closed if server approval is unavailable or rejected.
- [x] Mark payment complete only after the backend confirms Pi completion.
- [x] Provide backend recovery for an interrupted payment using the payment identifier and transaction ID.
- [ ] Add durable idempotency records and reconciliation jobs; current routes query Pi but do not persist an application ledger.
- [ ] Test cancellation, retries, duplicate callbacks, user mismatch, wrong recipient and wrong network.

### Travel search and mapping
- [x] Amadeus Test API flight search adapter.
- [x] Google Routes API adapter with server-side key.
- [ ] Hotel offers adapter and provider agreement.
- [ ] Tours/activities provider adapter.
- [ ] Currency/tax normalization and time-zone-safe itinerary display.
- [ ] Provider contract tests and fixture-based tests that never masquerade as live results.

### Booking and logistics
- [ ] PostgreSQL schema and migrations for booking lifecycle, traveler profiles, provider inventory snapshots, payment linkage, refunds and audit log.
- [ ] Reservation hold/confirm/expire state machine with provider idempotency.
- [ ] Partner portal, KYB/business verification and scoped partner access.
- [ ] Carrier adapters, signed tracking webhooks, shipment events and proof of delivery.

### Subscriptions and app token
- [ ] Define subscription products, billing periods, cancellation and entitlement rules.
- [ ] Define token purpose, supply, permissions, governance, distribution and legal review.
- [ ] Implement Soroban contracts only after a reviewed specification and threat model.
- [ ] Compile, unit test, integration test, audit and deploy to Testnet; save contract IDs and verify state by network readback.
- [ ] No Mainnet minting or claims of value, redemption or yield without separate approval and verification.

## Local verification

Run:

```bash
npm ci
npm run check:syntax
npm test
npm run build
```

Then configure Testnet credentials and execute the manual matrix below.

## Manual Testnet matrix

| Area | Scenario | Expected result |
|---|---|---|
| Auth | Valid Pi Testnet user | Server returns verified user DTO |
| Auth | Invalid/expired token | 401; frontend remains disconnected |
| Payment | Missing server API key | 503; no success state |
| Payment | Approval provider/network error | Payment flow fails closed |
| Payment | Successful approval and completion | UI success only after backend confirmation |
| Payment | Interrupted payment with txid | Backend verifies and recovers it |
| Payment | Duplicate completion callback | Idempotent response from Pi state; ledger persistence still pending |
| Flight | Missing Amadeus credentials | 503; no invented flight offers |
| Flight | Valid IATA/date and test credentials | Provider response and retrieval timestamp displayed |
| Maps | Missing Google key | 503; no fabricated route or ETA |
| Deploy | Netlify API request | Function handles API path, not SPA fallback |

## Known limitations at branch creation

No database, real booking provider, hotel/tour inventory, logistics carrier integration, subscription contract, or custom token deployment is present. These remain explicit work items rather than simulated features. External provider credentials and Pi Testnet API key must be configured by the repository owner in local/Netlify secret settings.
