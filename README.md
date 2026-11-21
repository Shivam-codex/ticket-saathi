# PassOn — India-first ticket resale

Peer-to-peer resale for movies, sports and concerts with face-value caps, transparent fees and Buyer Protection.

## Phase 1 (this release)
- Stack: TanStack Start + TypeScript + Tailwind v4 + shadcn/ui, Lovable Cloud (Postgres, Auth, Storage, RLS).
- i18n: English, Hindi, Marathi (header globe menu). Light/dark mode. Installable (manifest).
- Auth: mobile OTP and Google. Profile completion with purpose-wise consent. Roles: buyer (default), seller, admin.
- Seller gate: verified phone + UPI or bank/IFSC → `become_seller()` grants the seller role.
- Privacy: consent history, change optional consents, Download my data (JSON), Delete my account.
- Legal pages: Terms, Refund & Buyer Protection, Privacy, Grievance Officer, Cookie notice.
- Layout: header with search, footer with legal links, mobile bottom nav.

## Phase 2 — Events & discovery
- Admin `/admin/events`: create/edit events (category, venue or new venue, IST date/time, banner upload or URL, organiser, face-value tiers, transfer allowed, resale max % override). Every save is audit-logged.
- Home: Trending, Near me (city picker), This weekend. `/events`: filters (city, category, date, max price) with pagination (12/page). `/events/:id`: listings sorted by price, server-rendered title/description/OpenGraph/JSON-LD.
- AI search: free text on `/events?q=` → Gemini (Lovable AI) → Zod-validated filters, with "Understood as" chips; falls back to keyword search on failure.
- Realtime: listing changes refresh counts on home, list and detail pages.
- 20 seeded events across Pune, Mumbai, Delhi, Bengaluru (8 venues).
- Performance: resized responsive images, lazy loading, skeleton loaders.

### Phase 2 test checklist
1. Home shows Trending, Near me and This weekend. Picking Mumbai changes Near me.
2. /events: Mumbai + Sports shows 3 events. Clear resets the filters. The page buttons appear when there are more than 12 results.
3. Search "cheap IPL tickets in Pune this Sunday" shows "Understood as: Pune · sports · IPL · under ₹1,000 · date".
4. Search "coldplay" finds the Coldplay event (keyword path).
5. Event page: view source has the event title in <title>, og:image and JSON-LD.
6. "Pushpa 3" shows "Resale not allowed".
7. As admin: create an event with 2 tiers and a banner. It appears on /events. Editing it writes an audit_logs row.
8. As non-admin, /admin/events redirects home.
9. Insert or activate a listing. The "on sale" count updates on home and the event page without a reload.

## Database
profiles, user_roles, venues, events, listings, orders, ledger_entries, payouts, disputes, notifications, fee_config (5%/5%/18% GST seeded), resale_rules (global face-value cap seeded), audit_logs, consents. RLS on every table.

## Env
See `.env.example`.

## Tests
`bunx vitest run`

## Test checklist (Phase 1)
1. Switch language to हिन्दी and मराठी. Header, home and footer text change, and the choice survives a reload.
2. Toggle dark mode. It survives a reload.
3. Search "test" from the header. The search page opens (it's empty until events are added).
4. Sign in with Google. You land on profile completion.
5. Try saving without the two required consents. You're blocked.
6. Complete your profile. Settings opens, and a consent row exists for each purpose.
7. Open /sell. The checklist shows phone and payout as not done.
8. Add an invalid UPI ID. You see an error. Add a valid one, and it saves.
9. Verify your phone in Settings (needs an SMS provider). Then on /sell, "Activate seller" works.
10. Toggle the marketing consent off and on. New consent rows are recorded.
11. Download my data. A JSON file with your profile and consents downloads.
12. Delete my account. You're signed out, and signing in again creates a fresh account.
13. Visit /settings while signed out. You're redirected to /auth.
14. Mobile width: the bottom nav shows and the active tab is highlighted. Footer legal links work.
15. Security: as a buyer, inserting into listings or fee_config through the API is rejected.

## Phase 3 — Selling safely

- `/sell` wizard: event → seats/qty → upload ticket (private) → price paid + asking price with live cap and fair-price hint.
- Rules engine `src/lib/listing-rules.server.ts` (tests: `src/lib/listing-rules.test.ts`).
- Verification `src/lib/verification/*`: QR decode (PNG/JPEG), Gemini vision read (PDF/images), duplicate QR/file block, name/date/seat match, editing checks, trust score (tests: `checks.test.ts`).
- `/my-listings`: edit price, pause/resume, cancel. `/admin/reviews`: approve/reject flagged tickets.
- Listings hide at event start; hourly job marks them expired.

### Phase 3 test checklist
- [ ] Non-resellable event is greyed out in the wizard.
- [ ] Asking price above the shown maximum shows the reason and disables "List ticket".
- [ ] Clear ticket with QR goes live; uploading the same ticket again is blocked as duplicate.
- [ ] Blurry/edited ticket lands in Admin → Ticket reviews; approve makes it live.
- [ ] Pause hides listing from the event page; resume shows it again; cancel frees the QR.
- [ ] Signed-in buyer cannot read another seller's ticket file.

## Phase 4 — Buying with mock UPI

- `/listings/:id`: live server quote with ticket price, buyer fee and GST, seller rating/sales, trust score and Buyer Protection.
- `/checkout/:listingId`: buyer name/phone/UPI, saved UPI preference and a ten-minute reservation.
- `/orders`: buyer and seller order history. `/orders/:id`: mock UPI intent + QR, simulated success/failure, private ticket delivery, completion, disputes and seller reviews. `/orders/:id/invoice`: printable **draft** GST invoice for the platform fee only.
- `src/lib/pricing.server.ts`: single integer-paise pricing source. With default 5% buyer/seller fees and 18% GST on each fee, a ₹1,000 ticket gives buyer total **₹1,059** and seller net **₹941**.
- Checkout correctness boundary: atomic database listing update + live-order unique index. Optional Upstash Redis adds a token-checked ten-minute lock when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured; the database remains authoritative.
- State transitions are validated and logged in `order_events`. Expired holds release on activity and through a once-per-minute reconciliation job.
- Payments are mock-only: the `passon-mock://` intent/QR never contacts a bank. The GST invoice remains a draft until the registered legal name, GSTIN and business address are configured.

### Phase 4 test checklist
- [x] Pricing unit tests cover the required ₹1,000 example, quantity, half-up rounding, zero fees/free tickets and invalid/overflow inputs.
- [x] Twelve simultaneous checkout attempts against a real listing produce one winner; idempotent retry returns the same order.
- [x] Forced expiry cancels the order and reactivates the listing.
- [x] Browser purchase: reserve → mock UPI success → private PNG ticket returns HTTP 200 → draft invoice → completion → five-star seller review.
- [x] Browser failure: mock UPI failure cancels the order and makes the same listing available again.
- [x] Orders list retains event/seat details after the listing is held or sold.
- [x] Mobile checkout has no horizontal overflow; seller rating and completed-sale count come from real orders.
- [ ] Configure Redis credentials and repeat checkout to exercise the Redis lock; only the atomic database lock was exercised here.
- [ ] Replace the mock adapter and draft tax details before accepting real payments.

## Phase 5 — Payments, ledger and payouts

- `PaymentProvider` supports `createOrder`, `verifyWebhook`, `refund`, `payoutToSeller` and `getStatus`. Mock remains the default; set `PAYMENT_PROVIDER=razorpay` only after marketplace approval.
- Razorpay test mode is connected through the provider connector. Real checkout is blocked until each seller has an approved Razorpay Route account. Transfers must use provider-held funds (`on_hold`); PassOn never implements its own escrow or holds customer funds by custom logic.
- **TODO: confirm payment-aggregator compliance with lawyer/CA before going live.** Also confirm Route/KYC, settlement, refund and marketplace eligibility with Razorpay.
- The public webhook requires `RAZORPAY_WEBHOOK_SECRET` and verifies `X-Razorpay-Signature` over the exact raw body before any order lookup or event write. It acknowledges unknown orders, deduplicates provider event IDs and reads payment/order status back from Razorpay before posting. Provider read-back and exact amount/order checks remain the proof of payment. Webhook URL: `/api/public/razorpay-webhook`; subscribe to `payment.captured`, `payment.authorized` and `order.paid` separately in test and live modes.
- Double-entry ledger groups every payment, refund and payout. TCS/TDS fields default to zero and are disabled until enabled by an admin; rates and applicability must be confirmed by a CA. `/admin/reconciliation` lists unbalanced groups and missing required entries.
- Undelivered tickets auto-refund 24 hours after payment. Seller payout releases only after delivery, then buyer entry confirmation or 24 hours after the recorded event end with no open dispute. Missing event end times block time-based release. A five-minute authenticated scheduler processes both.
- `/seller/earnings` shows pending/released proceeds, seller fees, GST, TCS/TDS and payout status, with PDF statements and per-order **draft** fee invoices. Provider references are deliberately excluded from browser responses.

### Phase 5 test checklist
- [x] Pricing and tax-hook unit tests cover zero/default TCS/TDS and the ₹1,000 → ₹1,059 / ₹941 example.
- [x] Real database integration covers one payment across duplicate webhooks, full undelivered-ticket refund, duplicate-refund safety and entry-triggered ₹941 payout.
- [x] Payout rules block disputes, undelivered orders, missing event ends and early release; reconciliation detects unbalanced or incomplete groups.
- [x] Scheduled maintenance rejects unauthorised calls and runs successfully with scheduler authentication.
- [x] Browser mock purchase, private ticket delivery and buyer entry confirmation complete successfully.
- [ ] Complete Razorpay Route approval and linked seller accounts before testing or enabling real charges/transfers.
- [ ] Obtain lawyer/CA approval for payment-aggregator compliance and tax treatment; GST and seller fee invoices remain drafts.

## Phase 6 — Trust and differentiation

- Disputes include evidence, seller responses, admin refund/payout decisions and audit logs. Reputation, trusted-report takedowns, grievance deadlines and admin controls are implemented.
- Price alerts, waitlist offers, in-app notifications, user-initiated WhatsApp sharing, temporary multilingual AI help, offline gate passes and 2–6 ticket checkout are included. Automatic email requires a verified sender.

## Phase 7 — Hardening and soft launch

- Invite-only soft launch is **enabled**. Initial invite: `PASSON-BETA-2026`; restrict or disable it in **Admin → Launch** before wider distribution. New buyers and sellers redeem once, then can leave the invite blank.
- Only allowlisted transferable events accept listings/checkout during soft launch. Admin → Events has a per-event kill switch; Admin → Launch has per-state switches. Existing orders remain readable.
- RLS integration tests cover every application table, anonymous private-data denial, self-verification protection, invite redemption, launch switches and privileged RPCs. Only three distinct trusted reporters can auto-hide a listing.
- Temporary rate limits are best-effort per Worker instance, not globally guaranteed. Cloudflare Turnstile supports phone signup and listing creation; configure `VITE_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, Auth captcha settings and `TURNSTILE_REQUIRED=true` before production.
- CSP/security headers and public-page edge caching are applied. Dependency audit is clean after patched overrides. Mock payments are blocked by default in production unless `ALLOW_MOCK_PAYMENTS=true`; never use that override for launch.
- Sentry/PostHog setup was declined, so integrations remain inactive and optional. If connected later, browser events are `listing_created`, `checkout_started`, `payment_success` and `dispute_opened`. Existing Lovable error reporting remains active.
- `/api/public/health` returns non-sensitive app/database health for an external uptime monitor.

## Local setup and verification

1. `bun install` and copy `.env.example` into the environment supplied by your hosting/tooling. Never commit secret values.
2. Use isolated staging credentials for tests. `bunx vitest run` runs unit and available integration tests; `bunx playwright test` runs the mobile full-flow journey.
3. `APP_ENV=staging bun scripts/seed-staging.ts` creates 20 clearly marked fixtures without duplicating them.
4. `APP_ENV=staging CONFIRM_STAGING_RESET=DELETE_STAGING_FIXTURES bun scripts/reset-staging.ts` removes only those fixtures and their transactions; it is not a production reset.
5. `bunx tsgo -b --noEmit` checks types. CI is in `.github/workflows/ci.yml`; set `CI_DATABASE_TESTS=true` and isolated staging variables/secrets to enable integration and Playwright jobs.

## Staging, production and backups

- Use separate staging and production backends, auth settings, payment credentials, invite audiences and secrets. Never point CI cleanup at production.
- Lovable preview/publish is the supported deployment path for this TanStack Start/Cloudflare Worker project. A Vercel deployment requires a separately configured Nitro/Vercel target and has **not** been built or verified here; do not assume the Cloudflare output is Vercel-compatible.
- Publish staging-like changes and run CI, Playwright, provider read-back, refund/payout and security checks before production. Run mobile Lighthouse against the public staging URL; local dev scores do not meet the launch requirement.
- Managed database backups are visible under **More → Database → Manage → Backups**. Before launch or restore, export current data under **More → Database → Manage → Settings → Export project data**. Storage files are not included; download them separately from **More → Storage**. A restore loses later data and reverts schema.

See `docs/COMPLIANCE.md` for lawyer/CA sign-off and `docs/LAUNCH.md` for the go/no-go checklist and known risks.
