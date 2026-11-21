# Phase 6 — Trust, safety and differentiation

## Trust and safety
- Extend disputes with a 48-hour evidence window, private evidence uploads, seller responses, admin refund/payout/reject decisions, notifications and immutable audit entries.
- Expand seller reputation with ratings, completed sales, dispute rate and a Verified seller badge. Enforce five listings/day for new sellers and record admin-only risk signals for event concentration, anomalous pricing and shared device hashes.
- Add listing reports with one report per user and automatic hiding after three distinct reports; reported listings cannot be resumed until admin review.
- Build admin overview, trust-sorted review queue, user ban/verification actions, dispute and grievance inboxes with due badges, takedown review, transaction/revenue charts, and fee/resale-rule editors.
- Add signed-in grievance submission and tracking with 72-hour response deadlines.

## Differentiating features
- Add event follows, price alerts and waitlists. New matching listings create notifications and a timed offer for the next eligible fan.
- Add a feature-flagged Gemini help widget in English/Hindi/Marathi with a single temporary conversation, streaming responses, fee/refund explanations and navigation help. It refuses legal advice and refund promises and links to human support; a deterministic FAQ fallback remains available when AI is disabled or fails.
- Add a notifications centre with one-tap WhatsApp and email actions for listing approval, ticket sale, payout and dispute updates. Automatic email remains blocked until a verified sender domain exists.
- Add paid-ticket wallet-style details and an offline-capable full-screen gate view; include Sell-back Guarantee as a clearly marked upcoming add-on with no charge.
- Support quantity selection for 2–6 seats from one listing, with all pricing and reservation math performed on the server.

## Technical work
- Add additive database tables, constraints, triggers and RLS for evidence, reports, waitlists/offers, risk signals, grievances, profile trust state and feature flags; preserve existing payment and ledger boundaries.
- Keep secrets and AI calls server-side, validate all input, audit privileged actions and avoid storing raw device identifiers.
- Add focused tests for dispute windows, report thresholds, new-seller limits, waitlist matching and group-checkout quantities; run the full suite and typecheck.
- Verify signed-in buyer/seller/admin flows in the browser, including evidence, takedown, waitlist notification, assistant fallback and offline gate mode. Document external-domain and provider limitations in README.
