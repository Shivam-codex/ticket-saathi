# Phase 4 — Buying flow

## What buyers and sellers will see
- A public listing page with seats, quantity, seller rating/status, verification badge, Buyer Protection, and a complete server-calculated price breakdown.
- A signed-in, mobile-first checkout collecting buyer name, phone and preferred UPI ID, with mock UPI app/QR payment choices.
- A ten-minute reservation countdown. Only one buyer can reserve a listing; retries with the same checkout key return the same order.
- An order page showing every state change, mock payment success/failure, private ticket delivery after payment, and a printable GST invoice for the buyer platform fee.
- Saved payment preferences in Settings and an Orders link for returning buyers.

## Money and payment rules
- Add one server-only pricing module using integer paise and configurable buyer/seller fee and GST basis points.
- Test the required Rs 1,000 example: buyer total Rs 1,059 and seller net Rs 941, plus rounding, zero and boundary cases.
- Keep the payment provider behind an adapter; the mock provider creates UPI-like intent/QR payloads without contacting a bank.

## Concurrency and data
- Add an atomic database checkout operation that changes an active listing to held and creates the order in one transaction.
- Add an Upstash Redis REST lock as a second guard when credentials are configured; the database operation remains the correctness boundary. Without credentials, checkout continues with the database lock and reports that Redis is unconfigured.
- Add order history entries and allowed state transitions: created, payment pending, paid, ticket delivered, completed, disputed, refunded, or cancelled.
- Release expired or failed reservations without reactivating tickets whose event has started.
- Add buyer contact snapshots, invoice fields, payment preferences, seller reviews, and row-level access rules.

## Verification
- Run pricing, transition, idempotency and concurrent-checkout tests.
- Exercise the real signed-in flow in the preview: create a hold, pay with the mock provider, read the order back, open the ticket and invoice.
- Update the README checklist and roadmap; identify anything requiring real payment, Redis or tax credentials.

## Technical notes
- TanStack Start server functions own all pricing, payment, private-file and privileged order work.
- New routes: public listing detail; authenticated checkout, orders and order detail/invoice.
- GST invoices remain explicitly marked draft until registered business details are supplied.
