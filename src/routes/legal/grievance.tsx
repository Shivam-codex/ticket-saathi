import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/legal/grievance")({
  head: () => ({ meta: [{ title: "Grievance Officer — PassOn" }, { name: "description", content: "Contact PassOn's Grievance Officer. We acknowledge within 24 hours and resolve within 15 days." }, { property: "og:title", content: "Grievance Officer — PassOn" }, { property: "og:description", content: "Contact PassOn's Grievance Officer. We acknowledge within 24 hours and resolve within 15 days." }] }),
  component: Page,
});

function Page() {
  return (
    <LegalPage title="Grievance Officer" updated="21 November 2026">
      <p>As required by the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and the DPDP Act, 2023, you can raise any complaint about content, transactions or your personal data with our Grievance Officer.</p>
      <div className="not-prose my-6 rounded-2xl border bg-card p-6">
        <p className="font-display text-xl font-bold">Shivam Shinde</p>
        <p className="text-sm text-muted-foreground">Grievance Officer, PassOn</p>
        <ul className="mt-4 space-y-1 text-sm" style={{ listStyle: "none", paddingLeft: 0 }}>
          <li>Email: <a className="underline" href="mailto:shivamshinde36513@gmail.com">shivamshinde36513@gmail.com</a></li>
          <li>Phone: <a className="underline" href="tel:+919011967964">+91 90119 67964</a> (Mon–Sat, 10 AM – 6 PM IST)</li>
        </ul>
      </div>
      <h2>Our response-time promise</h2>
      <ul>
        <li><strong>Acknowledgement within 24 hours</strong> of receiving your complaint.</li>
        <li><strong>Resolution within 15 days.</strong></li>
        <li>Requests to remove unlawful content or impersonation are acted on <strong>within 72 hours</strong> (24 hours for content showing private images).</li>
      </ul>
      <h2>What to include</h2>
      <p>Your name, registered mobile number, order ID (if any), a description of the issue, and any screenshots.</p>
    </LegalPage>
  );
}
