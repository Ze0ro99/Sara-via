# SARA VIA — Pi Network Testnet Travel Platform

SARA VIA is a travel and logistics platform prototype being prepared for **Pi Testnet integration and verification**. It is not a Mainnet release and does not represent live inventory unless a provider is configured and returns current results.

## Current capabilities in this branch

- Luxury navy-and-gold identity with a custom SVG monogram.
- Pi SDK initialization in sandbox mode.
- Server-side Pi user verification through `/api/auth/me`.
- Fail-closed Pi payment approval and server-confirmed completion; incomplete-payment recovery is routed through the backend.
- Express API mounted for local use and Netlify Functions.
- Flight offer search through the Amadeus **test** API when credentials are supplied.
- Route calculation through Google Routes API when a server-side key is supplied.
- Provider status endpoint: `GET /api/travel/status`.

## Run locally

Requires Node.js 20 or later.

```bash
npm ci
cp .env.example .env
npm run check:syntax
npm test
npm run build
npm start
```

Open `http://localhost:3000`. For Pi authentication and payments, use the Pi Browser Testnet environment and configure a Testnet Server API key. Never expose provider keys or Pi server keys in frontend code.

## Environment variables

See [`.env.example`](.env.example). Flight search requires `AMADEUS_CLIENT_ID` and `AMADEUS_CLIENT_SECRET` from an Amadeus test account. Route calculation requires `GOOGLE_ROUTES_API_KEY`. The keys are read only by server code.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api` | API status |
| GET | `/health` | Health check |
| GET | `/api/config` | Public, non-secret environment status |
| GET | `/api/travel/status` | Provider readiness |
| POST | `/api/travel/flights/search` | Live Test API flight offers |
| POST | `/api/travel/routes/compute` | Google route calculation |
| GET | `/api/auth/me` | Verify Pi access token |
| POST | `/api/payments/approve` | Verify and approve Pi payment |
| POST | `/api/payments/complete` | Verify and complete Pi payment |

## Booking, hotel, tour and logistics roadmap

The current repository does **not** yet contain a persistent booking database, hotel/tour inventory contract, partner onboarding, subscription ledger, shipment tracking provider, or deployed custom token. These are intentionally not represented as working services. They require provider agreements/API credentials, durable storage, booking state transitions, cancellation/refund policy, idempotency keys, audit records, and partner acceptance tests. Add each adapter behind server-side interfaces and only show inventory returned by the connected provider.

Recommended next implementation stages:

1. Add PostgreSQL persistence and migrations for users, search sessions, booking intents, reservations, payments, refunds, subscriptions, partners and shipments.
2. Add a hotel inventory provider and a tour/operator adapter with normalized availability, local time zones, currency, taxes and cancellation terms.
3. Add partner onboarding and logistics carrier webhooks with signed event verification and proof-of-delivery records.
4. Add Testnet subscription and token contracts only after requirements, economics, access control, audit, tests and on-chain readback are complete. Do not imply a token has value or is deployed before verification.
5. Run Pi payment, recovery, cancellation, duplicate callback, provider outage and booking/payment reconciliation tests before any Mainnet review.

## Netlify

Build command: `npm run build`; publish directory: `dist`; functions directory: `netlify/functions`. Configure environment variables in Netlify site settings. Do not put secrets in `netlify.toml` or commit a real `.env` file.

## Mainnet readiness gate

This branch is Testnet-only. Mainnet must remain disabled until the Pi team/platform permissions, production API configuration, provider contracts, security review, data retention/privacy review, financial reconciliation, and operational monitoring are explicitly verified. A Testnet success is not proof of Mainnet approval.
