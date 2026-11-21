# Phase 7 — hardening and launch

## Security and launch controls
- Add automated database checks for RLS coverage, anonymous/authenticated permissions, private ticket access, and admin-only writes; fix confirmed exposure without restricting intentional public event discovery or fee/rule reads.
- Add the confirmed best-effort per-instance rate limits to sensitive server actions, documenting that they are not globally guaranteed.
- Add Cloudflare Turnstile to phone signup and listing creation with server verification; keep a clearly labelled development fallback only when keys are absent.
- Add CSP and standard security headers, check secret configuration without exposing values, and upgrade or override vulnerable dependencies where compatible.
- Enable invite-only soft launch, transferable-event allowlisting, and event/state listing kill switches, enforced by server/database rules rather than UI alone.

## Tests and quality
- Add Playwright coverage for signup, listing, mock purchase, dispute and admin refund, with explicit test fixtures and cleanup.
- Keep the existing concurrent double-sell integration test in CI alongside Vitest pricing/rules/security suites.
- Run focused tests, typecheck and browser verification; measure local mobile performance and record anything that still requires public staging for a valid Lighthouse score.

## Observability and operations
- Connect Sentry and PostHog through their native connectors when available, then instrument listing_created, checkout_started, payment_success and dispute_opened without personal/payment secrets.
- Add a non-sensitive health endpoint suitable for external uptime monitoring.
- Add GitHub Actions CI, safe seed/reset scripts, deployment/configuration documentation, and clearly separate Lovable hosting from any optional Vercel setup.

## Compliance and launch documentation
- Create docs/COMPLIANCE.md for lawyer/CA sign-off covering resale rules, GST invoices, TCS/TDS, payment-aggregator/escrow, grievance officer, intermediary terms, consent/deletion and refunds.
- Finish README setup/deployment steps plus a launch checklist and known-risks register, including unverified production integrations and legal blockers.

## Technical constraints
- Use TanStack Start server functions/routes and Lovable Cloud migrations; do not add Next.js or edit generated/migration files directly.
- Preserve integer-paise server-side pricing, mock payment default, provider-held transfer requirements, RLS role separation, and English/Hindi/Marathi UI strings.
