# SARA VIA — Developer handoff and Testnet release requirements

This checklist is the implementation and configuration contract for the developer completing the Testnet deployment. Do not mark an integration active until its credentials, provider agreement, sandbox connection and end-to-end verification have been confirmed.

## 1. Pi Developer Portal and wallet

Register a dedicated **Pi Testnet app** in the Pi Developer Portal. The selected network is fixed for that app; create a separate Mainnet app later rather than switching this one.

Required server configuration:
- `PI_API_BASE=https://api.minepi.com/v2` — current Platform API base path. The registered app's network and Pi SDK sandbox determine the Testnet context; do not invent a separate Platform API hostname.
- `PI_API_KEY` — the Server API Key generated in the SARA VIA Testnet app's Developer Portal. Server-side only; use Netlify encrypted environment variables or a secret manager.
- `PI_WALLET_ADDRESS` — the public address of the app wallet connected to this Testnet app. The payment verifier uses it to check the recipient.
- `APP_ENV=testnet`.
- `CORS_ORIGIN` — optional comma-separated exact origins only if a separate frontend origin is intentionally used. Same-origin deployment needs no CORS allowlist.

The app wallet is created/connected through the Developer Portal. For ordinary User-to-App payments, the Server API Key and public app wallet address are the required server configuration. **Do not put the wallet secret seed in the frontend or GitHub.** A wallet secret seed is not needed by the current U2A payment flow. If a separately approved App-to-User payout feature is implemented later, the developer must provision a dedicated payout wallet and keep its secret seed in a managed secret vault with strict access controls, rotation/recovery procedures and transaction limits. Do not enable A2U from this branch without a separate security review and Pi network capability confirmation.

## 2. Travel provider credentials

Use sandbox/test credentials for Testnet:
- Amadeus: `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, `AMADEUS_BASE_URL=https://test.api.amadeus.com`.
- Google Routes: `GOOGLE_ROUTES_API_KEY`, restricted in Google Cloud to the required Routes API and server environment.
- Hotels: `HOTEL_PROVIDER_BASE_URL`, `HOTEL_PROVIDER_API_KEY`.
- Cruises: `CRUISE_PROVIDER_BASE_URL`, `CRUISE_PROVIDER_API_KEY`.
- Tours: `TOUR_PROVIDER_BASE_URL`, `TOUR_PROVIDER_API_KEY`.
- Logistics: `LOGISTICS_PROVIDER_BASE_URL`, `LOGISTICS_PROVIDER_API_KEY`.

Hotel/cruise/tour/logistics adapters are generic provider adapters, not pre-authorized integrations. Each provider must supply its API base URL, API credentials, data schema, booking/cancellation/refund rules, webhook signing method and test account. Developer must map and test the provider's documented API contract before enabling it. Use HTTPS only. Never expose provider secrets to the browser or another provider.

## 3. Provider registration

The public provider application form collects legal business name, service type, country code, contact email, optional HTTPS website and service description. The user must connect Pi first. New applications are pending review.

Apply:
- `supabase/migrations/001_initial_testnet_schema.sql`
- `supabase/migrations/002_service_provider_onboarding.sql`

Configure:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The Supabase service-role key is server-only. RLS is enabled and no public/anon policies are created. The backend verifies Pi UID before inserting or reading a provider application.

Do not ask applicants to paste API keys, wallet seeds, passwords, identity documents or webhook secrets into the public registration form. Complete KYB/business review first. Then an administrator provisions the integration in an approved encrypted secret manager and records only a secret reference in `provider_integrations.credential_secret_ref` / `webhook_secret_ref`. The actual secret value must not be stored in a plaintext database column.

## 4. Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Node runtime: 20
- Configure each required environment variable in Netlify Site configuration → Environment variables, not in `netlify.toml`.
- Deploy preview/Testnet URL must be registered as the Development URL in the Pi Testnet app's Developer Portal and authorized in Pi Browser Sandbox.

## 5. Developer acceptance checklist

- [ ] Provision a dedicated Pi Testnet app, obtain Server API Key and connect its Testnet app wallet.
- [ ] Set PI_API_KEY, PI_WALLET_ADDRESS, APP_ENV=testnet and PI_API_BASE in encrypted deployment settings.
- [ ] Apply both Supabase migrations and test provider registration, duplicate submission, read-your-own-application and unauthenticated rejection.
- [ ] Add Amadeus and Google test credentials; run live test queries and verify timestamp, currency and returned provider identifiers.
- [ ] Each real hotel/cruise/tour/logistics partner supplies its own API contract and sandbox credentials; implement contract mapping and webhook signature validation.
- [ ] Run U2A tests: valid payment, wrong recipient, wrong network, zero/invalid amount, unapproved completion, cancelled payment, duplicate completion, wrong user and provider/API outage.
- [ ] Connect payment completion to a durable order/payment ledger and booking confirmation state machine before selling/confirming actual travel inventory.
- [ ] Add provider KYB review/admin controls, secret-vault provisioning and audit trail before switching any provider integration to active.
- [ ] Verify Netlify functions and browser flows inside Pi Browser Sandbox.
- [ ] Keep Mainnet and App-to-User withdrawals disabled until a separate release/security approval.

## 6. What must not be fabricated

The developer must not invent Pi API keys, wallet addresses/private seeds, Google or Amadeus credentials, hotel/airline/carrier partner credentials, contract IDs, booking confirmations or test results. Credentials are issued by the corresponding account owner/provider. The repository contains only variable names and placeholders; actual values are supplied securely by the project owner and each approved service provider.
