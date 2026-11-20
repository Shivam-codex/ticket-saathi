import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — PassOn" }, { name: "description", content: "How PassOn collects, uses and protects your personal data under India's DPDP Act." }, { property: "og:title", content: "Privacy Policy — PassOn" }, { property: "og:description", content: "How PassOn collects, uses and protects your personal data under India's DPDP Act." }] }),
  component: Page,
});

function Page() {
  return (
    <LegalPage title="Privacy Policy" updated="21 November 2026">
      <p>We follow the Digital Personal Data Protection Act, 2023. We collect only what's needed and use it only for the purposes you agreed to.</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account:</strong> name, mobile number, email (if you sign in with Google), state, language.</li>
        <li><strong>Selling:</strong> UPI ID or bank account and IFSC for payouts, and ticket details and proof.</li>
        <li><strong>Orders:</strong> purchases, payments (handled by our payment partner; we never see your full card details), disputes.</li>
        <li><strong>Consent records:</strong> what you agreed to, when, and which policy version.</li>
      </ul>
      <h2>Purposes, each with its own consent</h2>
      <ul>
        <li><strong>Terms and transactions (required):</strong> running your account, purchases, sales, payouts, refunds, fraud prevention and legal compliance.</li>
        <li><strong>Marketing (optional):</strong> offers and event alerts.</li>
        <li><strong>Analytics (optional):</strong> improving PassOn using your activity.</li>
        <li><strong>Personalisation (optional):</strong> tailored event suggestions.</li>
      </ul>
      <p>You can withdraw optional consents any time in Settings. Withdrawing doesn't affect anything done before.</p>
      <h2>Who we share data with</h2>
      <p>We share data only to complete your transactions: the other party to your order (name only, as needed for the ticket transfer), our payment partner, our cloud hosting provider, and authorities when the law requires it. We never sell your data.</p>
      <h2>Website analytics</h2>
      <p>Our hosting provider, Lovable, may record anonymous visit statistics without cookies (pages visited, referrer, country, browser, device type, time on page, load speed and errors). It does not store anything on your device, keep IP addresses or identify you. Lovable collects this data for us. <a href="https://lovable.dev/privacy" className="underline">Lovable's privacy policy</a> explains how it handles it. Detailed data is kept for 90 days and daily summaries for a year.</p>
      <h2>Your rights</h2>
      <ul>
        <li><strong>Access:</strong> use "Download my data" in Settings.</li>
        <li><strong>Erasure:</strong> use "Delete my account" in Settings. Records of completed orders are kept without your name, as tax law requires.</li>
        <li><strong>Correction and complaints:</strong> edit your profile, or contact our <Link to="/legal/grievance" className="underline">Grievance Officer</Link>. You may also approach the Data Protection Board of India.</li>
      </ul>
      <h2>Retention and security</h2>
      <p>We keep account data while your account is active, and transaction records for 8 years as tax law requires. Data is encrypted in transit, and access is limited by strict permissions.</p>
    </LegalPage>
  );
}
