# PassOn compliance sign-off

**Status: draft for lawyer/CA review. This file is not legal, tax or payment advice. Production launch remains blocked until every required row is signed off.**

| Area | Approval required | Evidence / current state | Owner | Sign-off |
| --- | --- | --- | --- | --- |
| State-wise resale | Confirm resale legality, face-value caps and state-specific prohibitions for every launch state. | Default cap is 100% of face value; state/event rules and listing kill switches exist. No rule is treated as a legal determination. | Lawyer | Pending |
| Organiser transfer rights | Confirm each allowlisted event permits transfer and resale. | `is_resellable` and soft-launch allowlist are independent controls. Start only with documented transferable events. | Lawyer / Operations | Pending |
| GST registration | Confirm whether and when PassOn must register, place-of-supply treatment and rates on buyer/seller fees. | Buyer/seller fees default to 5% each; 18% GST applies to each fee and is configurable. | CA | Pending |
| GST invoices | Confirm tax invoice format, registered legal name, GSTIN, address, numbering and seller fee invoices. | All generated invoices are visibly **DRAFT** and unsuitable for tax credit until registered details are configured. | CA | Pending |
| TCS / TDS | Confirm applicability, rates, thresholds, reporting and seller documentation. | Hooks exist with zero defaults and are disabled. Do not enable without CA instructions. | CA | Pending |
| Payment aggregator / escrow | Confirm marketplace payment flow, settlement, refunds, KYC and provider-held transfers. **Confirm payment-aggregator compliance with lawyer/CA before going live.** | PassOn must use Razorpay Route/provider-held compliant transfers only. Custom escrow or holding customer funds is prohibited. Real charges remain blocked until Route is approved. | Lawyer / CA / Provider | Pending |
| Mock payments | Confirm mock mode cannot be mistaken for a live charge. | Mock UI is labelled demo. Production mock payments require an explicit override and must remain off for launch. | Engineering / CA | Pending |
| Intermediary terms | Review intermediary model, seller ownership/genuineness warranty, prohibited tickets, liability and takedown rights. | Draft Terms exist at `/legal/terms`. | Lawyer | Pending |
| Refund & Buyer Protection | Review rejection-at-entry evidence, 48-hour dispute window, 24-hour undelivered-ticket refund and payout timing. | Draft policy exists at `/legal/refund-policy`; assistant never approves or promises refunds. | Lawyer / CA | Pending |
| Grievance officer | Confirm appointment, contact publication and response process. | Shivam Shinde, shivamshinde36513@gmail.com, +91 90119 67964. No office address supplied. Response target shown as 72 hours. | Lawyer / Operations | Pending |
| Data protection | Review purpose-wise consent, processors, retention, cross-border processing and DPDP obligations. | Required and optional consents are append-only; analytics/monitoring connectors are inactive unless enabled. | Lawyer / Privacy | Pending |
| Export and deletion | Verify account deletion/export covers profiles, consents, orders, files and legal retention exceptions. | Settings provides JSON export and deletion. Financial/legal records may need a documented retention exception. | Lawyer / Privacy | Pending |
| Ticket files and evidence | Confirm private storage, access windows, retention and deletion of IDs/tickets/evidence. | Ticket proofs and dispute evidence are private; buyer ticket access follows payment. | Lawyer / Security | Pending |
| Notifications | Review consent and sender requirements for email, SMS and WhatsApp. | Automatic email requires a verified sender; WhatsApp currently uses user-initiated sharing. Phone OTP requires an SMS provider. | Lawyer / Operations | Pending |
| Soft launch | Approve invite audience, eligible events, incident contacts and rollback procedure. | Invite-only mode is enabled. Initial invite is `PASSON-BETA-2026`; rotate/disable it before broader distribution. Event and state kill switches are in Admin → Launch/Events. | Operations / Lawyer | Pending |

## Required launch sign-off record

Record reviewer name, organisation, date, scope and written approval reference for every pending row. Do not replace legal/tax review with automated tests.
