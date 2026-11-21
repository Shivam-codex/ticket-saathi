# Roadmap
- [x] Phase 1: setup, schema+RLS, auth, consent/privacy, legal pages, layout
- [x] Phase 2: admin events, discovery pages, AI search, realtime counts, seed data
- [ ] Phone OTP live — blocked: SMS provider must be connected in Auth settings
- [ ] Make an admin — blocked: user must sign in once so their account can be given the admin role
- [x] Phase 3: pricing rules + tests, create listing, verification, seller controls
- [x] Phase 4: listing detail, tested checkout pricing, atomic 10-minute holds, mock UPI, orders, ticket delivery, reviews, invoice
- [ ] Real payment provider — later phase; Phase 4 uses the mock adapter
- [ ] Production GST invoice — blocked: registered legal name, GSTIN and business address not supplied
- [ ] Redis credentials — optional until supplied; database hold remains the correctness boundary and is tested
