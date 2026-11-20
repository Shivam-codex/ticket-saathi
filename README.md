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
