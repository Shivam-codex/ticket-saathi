import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({ meta: [{ title: "Terms of Use — PassOn" }, { name: "description", content: "PassOn's terms: our intermediary role, seller warranties and buyer rights." }, { property: "og:title", content: "Terms of Use — PassOn" }, { property: "og:description", content: "PassOn's terms: our intermediary role, seller warranties and buyer rights." }] }),
  component: Page,
});

function Page() {
  return (
    <LegalPage title="Terms of Use" updated="21 November 2026">
      <p>PassOn ("we") runs an online marketplace where people resell event tickets they can no longer use. By using PassOn you agree to these terms.</p>
      <h2>1. We are an intermediary</h2>
      <p>PassOn is an intermediary under the Information Technology Act, 2000. We do not own, issue or sell tickets. Each sale is a contract between the <strong>seller</strong> and the <strong>buyer</strong>. We provide the platform, payment collection, Buyer Protection and dispute handling.</p>
      <h2>2. Seller warranty</h2>
      <ul>
        <li>You own the ticket and have the right to transfer it.</li>
        <li>The ticket is genuine, valid, unused and has not been sold or shared elsewhere.</li>
        <li>The event organiser allows transfer. Events marked non-resellable cannot be listed.</li>
        <li>Your listed price follows the price cap shown for that event and your state (by default, no more than what you paid).</li>
      </ul>
      <p>If a ticket you sold is rejected at entry or is found to be invalid, we will refund the buyer and recover the full amount, fees and any costs from you. We may suspend your account and report fraud to the authorities.</p>
      <h2>3. Prices and fees</h2>
      <p>Buyers and sellers each pay a platform fee, plus GST on that fee. The full amount you pay or receive is shown before you confirm. There are no hidden charges.</p>
      <h2>4. Account and eligibility</h2>
      <p>You must be 18 or older and give accurate information. Sellers must verify a mobile number and add payout details before listing.</p>
      <h2>5. Prohibited use</h2>
      <ul><li>Fake, duplicate or stolen tickets.</li><li>Bulk buying to resell (touting) or using bots.</li><li>Listing above the allowed price cap or where state law prohibits resale.</li></ul>
      <h2>6. Liability</h2>
      <p>Our liability for any order is limited to the amount paid for that order. We are not responsible for event cancellations or changes by the organiser, but we will help with refunds as set out in our <Link to="/legal/refund-policy" className="underline">Refund &amp; Buyer Protection policy</Link>.</p>
      <h2>7. Complaints and law</h2>
      <p>Contact our <Link to="/legal/grievance" className="underline">Grievance Officer</Link>. These terms are governed by Indian law, and courts in Mumbai, Maharashtra have jurisdiction.</p>
    </LegalPage>
  );
}
