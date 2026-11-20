import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/legal/refund-policy")({
  head: () => ({ meta: [{ title: "Refund & Buyer Protection — PassOn" }, { name: "description", content: "How PassOn's Buyer Protection guarantee and refunds work." }, { property: "og:title", content: "Refund & Buyer Protection — PassOn" }, { property: "og:description", content: "How PassOn's Buyer Protection guarantee and refunds work." }] }),
  component: Page,
});

function Page() {
  return (
    <LegalPage title="Refund & Buyer Protection" updated="21 November 2026">
      <h2>Buyer Protection guarantee</h2>
      <p>If your ticket is <strong>rejected at entry</strong>, is invalid, or doesn't arrive before the event, you get a <strong>full refund</strong>, including the ticket price, platform fee and GST.</p>
      <h2>How to claim</h2>
      <ul>
        <li>Raise a dispute from your order within <strong>48 hours</strong> after the event start time.</li>
        <li>Add proof where you can: a photo of the gate rejection, a message from the venue, or a screenshot.</li>
        <li>We review it within 5 working days. Approved refunds go back to your original payment method within 5–7 working days.</li>
      </ul>
      <h2>Event cancelled or postponed</h2>
      <p>If the organiser cancels, we refund you in full once the organiser's refund reaches the seller, or earlier from the seller's held payout. If the event is postponed, your ticket usually stays valid. Contact us if you can't attend the new date.</p>
      <h2>When refunds don't apply</h2>
      <ul><li>You change your mind after buying.</li><li>You arrive late or are refused entry for reasons unrelated to the ticket (conduct, ID, age limits).</li></ul>
      <h2>Seller payouts</h2>
      <p>Seller payouts are held until after the event so Buyer Protection can be honoured.</p>
    </LegalPage>
  );
}
