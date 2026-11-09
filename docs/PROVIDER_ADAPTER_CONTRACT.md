# External provider adapter contract (Testnet)

SARA VIA normalizes provider calls at the application boundary. The hotel, tour and logistics integrations below are generic server-to-server adapters because each provider has its own contract. Configure only a provider whose API documentation and credentials you control; do not send keys from the browser.

## Environment configuration

- Hotels: `HOTEL_PROVIDER_BASE_URL`, `HOTEL_PROVIDER_API_KEY`
- Tours/activities: `TOUR_PROVIDER_BASE_URL`, `TOUR_PROVIDER_API_KEY`
- Logistics: `LOGISTICS_PROVIDER_BASE_URL`, `LOGISTICS_PROVIDER_API_KEY`

The adapter sends a Bearer token from the server and expects JSON. The provider base URL should be the provider's dedicated API host. The adapter calls the fixed relative endpoints below.

## Endpoints

- `POST /api/travel/providers/hotels/search` -> provider `POST /search`
- `POST /api/travel/providers/tours/search` -> provider `POST /search`
- `POST /api/travel/providers/logistics/quote` -> provider `POST /quote`
- `POST /api/travel/providers/logistics/track` -> provider `POST /track` with `trackingNumber`

Request and response schemas must be agreed with each provider before enabling the adapter. Search results must include provider identifiers, availability timestamp, currency, taxes/fees, cancellation terms and a stable offer reference. Tracking events should include carrier event ID, event timestamp/time zone, location, status and signed webhook verification. This generic adapter does not itself provide a provider account, inventory or carrier access.

## Required before booking acceptance

Implement a normalized quote/offer validator, signed webhook validation, per-provider idempotency, durable booking/payment linkage and reconciliation. Reject expired offers and never infer a booking confirmation from a successful payment alone.
