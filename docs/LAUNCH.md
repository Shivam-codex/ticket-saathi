# Launch checklist and known risks

## Go/no-go checklist

- [ ] Lawyer/CA has signed every applicable row in `docs/COMPLIANCE.md`.
- [ ] Razorpay Route and linked seller accounts are approved; provider-held transfers, refunds and read-back are tested in production-like mode.
- [ ] `PAYMENT_PROVIDER=razorpay`; `ALLOW_MOCK_PAYMENTS` is absent or `false`.
- [ ] `RAZORPAY_WEBHOOK_SECRET` is set; live webhook signature tests pass. Never run the live webhook without signature verification.
- [ ] Registered legal name, GSTIN and invoice address are configured; invoices no longer say DRAFT.
- [ ] Cloudflare Turnstile site/secret keys are configured in Auth and the app, and `TURNSTILE_REQUIRED=true`.
- [ ] Phone SMS provider is configured and OTP delivery is tested. Google sign-in is tested on the production origin.
- [ ] Sentry/PostHog remain disabled or are explicitly connected and privacy-reviewed. Their setup was declined during Phase 7 development.
- [ ] External uptime monitor calls `/api/public/health` and alerts on non-200 responses.
- [ ] CI runs unit tests, RLS/integration tests, the concurrent double-sell test and the Playwright journey against isolated staging data.
- [ ] Home and Event pages achieve Lighthouse >=90 on mobile against public staging; local measurements are not a substitute.
- [ ] Initial invite `PASSON-BETA-2026` is disabled or restricted; invite distribution has an owner.
- [ ] Every soft-launch event has documented organiser transfer permission. Event/state kill-switch drill is complete.
- [ ] A daily database backup is visible under **More → Database → Manage → Backups** and a current export is downloaded before launch. Storage files are downloaded separately from **More → Storage**.
- [ ] Support, grievance, dispute and refund on-call owners are assigned.
- [ ] Rollback and incident contacts are documented and tested.

## Verified locally

- 90 unit/integration tests pass, including RLS coverage, concurrent double-sell prevention, duplicate webhooks, refunds, payouts, launch controls and dispute timing.
- The mobile Playwright journey passes through listing, onboarding, mock purchase, dispute and admin refund.
- Type checks pass; `/api/public/health` returns database health and security headers are present.
- Final quick security scan has no warnings: five informational notices cover intentionally public events/venues and narrowly scoped fee/rule/rating read functions.
- Dependency audit reports no known vulnerabilities in 74 production dependencies.

## Known risks

| Risk | Current mitigation | Remaining action |
| --- | --- | --- |
| State resale law is uncertain or changes | Default face-value cap, state rules and kill switches | Obtain state-by-state legal sign-off and monitor changes |
| Counterfeit/duplicate tickets | QR/file duplicate checks, trust review, private files | Manual review quality and organiser validation remain necessary |
| Provider/marketplace approval | Real payments blocked until Route readiness | Complete provider KYC and lawyer/CA review |
| Tax errors | Integer-paise pricing and disabled tax hooks | CA-approved GST/TCS/TDS configuration |
| Mock payment misuse | Production gate plus clearly labelled demo UI | Keep production override off |
| Abuse through reports | Only three distinct trusted reporters auto-hide; all reports can be reviewed | Monitor coordinated trust abuse |
| Rate-limit bypass across instances | Confirmed best-effort per-instance limits | Replace with platform-standard global limiting when available |
| Turnstile not configured | Development fallback is explicit | Production launch requires keys and fail-closed setting |
| AI prompt injection/cost abuse | Server-owned system role, signed-in AI, bounded messages, curated fallback | Monitor outputs and usage; keep flag off if unsafe |
| Monitoring not connected | Existing Lovable error reporting remains | Connect Sentry/PostHog only after account/privacy setup |
| No measured public Lighthouse score | Responsive images, lazy loading and caching are present | Run Lighthouse on public staging before launch |
| Backup restore mismatch | Daily managed snapshots and export guidance | Test isolated restore and application compatibility |
| Email/WhatsApp delivery gaps | In-app notifications and user-initiated WhatsApp share | Configure verified sender/provider if automatic delivery is required |

## Rollback

1. Disable affected events or states in Admin → Launch/Events; this blocks new listings and checkout but preserves existing orders.
2. Disable new invites or enable invite-only mode if it was relaxed.
3. Keep real payments off until payment, refund and ledger health is confirmed.
4. Use database restore only after reviewing snapshot loss and exporting current data; schema also reverts, so retest the app afterwards.
