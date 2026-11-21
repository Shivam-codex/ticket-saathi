# Phase 5 — Payments, ledger and payouts

## Provider adapter and checkout
- Expand the payment-provider contract with `createOrder`, `verifyWebhook`, `refund`, `payoutToSeller` and `getStatus`; retain the current mock UPI experience.
- Add a server-only Razorpay test-mode adapter using the connected gateway. Real orders require a seller Route linked-account ID and create provider-managed, on-hold transfers for seller proceeds. Without Route approval, Razorpay checkout returns a clear configuration requirement and mock remains the default.
- Add Razorpay Checkout support to the existing order page. Payment confirmation reads the order back from Razorpay and verifies paid status and exact paise amount before fulfilment; client callbacks alone never mark an order paid.
- Add a retry-safe public webhook. Because the connector does not expose a webhook signing secret and Razorpay’s webhook Secret field remains empty, authenticity comes from Razorpay read-back verification rather than trusting the event body. Unique provider event IDs prevent duplicate processing.

## Financial records
- Extend orders with provider, delivery, refund, entry-confirmation and payout timestamps/references; add optional event end times and seller Route account references.
- Add webhook receipt and payment-operation idempotency records.
- Extend the append-only ledger into balanced transaction groups covering ticket value, buyer/seller fees, GST, provider settlement, refunds and payouts. Add disabled-by-default TCS/TDS configuration and zero-valued ledger fields, documented as placeholders whose rates and applicability require CA confirmation.
- Record balanced payment, refund and payout entries through service-role-only database functions. Add an admin reconciliation page showing expected versus recorded totals and unbalanced/missing-entry exceptions.

## Delivery, refunds and payout release
- Centralise the release policy in a tested module: release after confirmed event entry, or 24 hours after the recorded event end with no dispute, whichever comes first. Missing event end times block time-based release rather than risking an early payout.
- Use a 24-hour post-payment delivery deadline unless the pending answer changes it. Due undelivered orders are refunded through the provider; refund retries first check existing provider refunds.
- Add an authenticated scheduled maintenance callback for automatic refunds and due payout releases. Provider transfers, not custom fund-holding logic, control real seller proceeds.
- Change the buyer action to confirm event entry and immediately release an eligible seller payout.

## Seller and admin UI
- Add Seller Earnings with pending/released totals, seller fee/GST/TCS/TDS breakdown and payout status.
- Add downloadable PDF statements and per-order draft seller-fee invoices using the existing print/PDF visual style; registered business tax details remain explicitly unconfigured.
- Add navigation from My Listings and an admin reconciliation report.

## Verification and documentation
- Unit-test refund balancing, duplicate webhook handling, payout timing/dispute rules and tax-disabled behaviour; add database integration coverage for idempotency where practical.
- Exercise the signed-in mock purchase through entry confirmation, payout, earnings and PDF downloads. Razorpay live checkout cannot be exercised without Route approval.
- Update README and the test checklist with the exact compliance note: “confirm payment-aggregator compliance with lawyer/CA before going live.” Document webhook setup, Route prerequisites and the 24-hour delivery window.
