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
