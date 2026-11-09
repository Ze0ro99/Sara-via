# Testnet token, subscription and smart-contract specification

## Scope and sources

This is the integration specification for the SARA VIA Testnet phase. Candidate standards and contract sources for review are:

- [Ze0ro99/PiRC](https://github.com/Ze0ro99/PiRC) — use its published schema and lifecycle specifications as candidate normative inputs, after checking the exact revision and applicable standard IDs.
- [Ze0ro99/SmartContracts](https://github.com/Ze0ro99/SmartContracts) — candidate Soroban contract workspace. Each crate must be independently compiled, tested and reviewed; repository presence is not proof of deployment.

No SARA VIA token, subscription contract or withdrawal/payout contract is declared deployed by this branch.

## Subscription model to implement

A subscription record must include: immutable subscription ID, Pi UID, plan ID/version, price/currency, billing interval, start/end times, status, provider/payment references, cancellation timestamp and audit metadata. The entitlement service must verify a server-confirmed Pi payment before activating access. Do not infer recurring charges: each renewal must follow a separately authorized payment flow supported by the Pi platform and user consent.

Required states: pending_payment, active, past_due, cancelled, expired, refunded. State transitions must be transactional and idempotent. Entitlements must be revoked or adjusted on cancellation, expiry, refund or charge reconciliation failure.

## SARA VIA utility token (proposed, not issued)

Before any token contract is written, approve a token design document containing:

- Name, symbol, decimals and fixed/capped supply policy.
- Utility limited to clearly described in-app uses (for example discounts or loyalty accounting), without promises of price appreciation, redemption, yield or profit.
- Mint/burn authority, role separation, pause/emergency controls and upgrade policy.
- Distribution, vesting, treasury controls, user disclosures and accounting.
- Transferability policy, compliance review and interaction with Pi wallet/token tooling.

Use integer atomic units and decimal strings for amounts. Do not use floating-point values for balances or settlements. If PiRC schemas are adopted, validate schema and separately enforce authorization, signatures, replay protection, business rules and chain readback.

## Soroban/Testnet acceptance gates

1. Pin the exact PiRC and SmartContracts commit SHAs used for the implementation.
2. Select or author a contract crate whose code actually implements the approved SARA VIA behavior; do not copy a generic template and label it complete.
3. Build with the documented Rust/Soroban toolchain and run unit, integration, authorization, replay, overflow, pause and upgrade tests.
4. Run a threat model and independent security review before deployment.
5. Deploy to Pi Testnet only, record network/passphrase, RPC URL, contract ID, deployer, transaction hash and source commit.
6. Read contract state back from the Testnet RPC and verify code hash, roles, supply and configuration.
7. Add backend transaction simulation/submission and frontend status polling with explicit pending/success/failure states.
8. Keep Mainnet deployment disabled until a separate approval and release process is complete.

## Withdrawals and payouts

Do not expose a withdrawal button as functional until the relevant Pi App-to-User capability is enabled for the selected network and the app wallet, API permissions, limits, recipient verification and recovery workflow are configured. The current UI must never suggest that a Testnet withdrawal is a real-money payout.

## Not yet implemented in this branch

Persistent subscription records, a SARA VIA token contract, deployed contract IDs, wallet token trustlines, app-to-user withdrawal execution, and automated contract deployment are not yet implemented. This document defines the gates rather than fabricating a contract or transaction result.
