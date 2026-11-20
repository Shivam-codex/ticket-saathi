import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({ meta: [{ title: "Cookie Notice — PassOn" }, { name: "description", content: "Which cookies and browser storage PassOn uses, and why." }, { property: "og:title", content: "Cookie Notice — PassOn" }, { property: "og:description", content: "Which cookies and browser storage PassOn uses, and why." }] }),
  component: Page,
});

function Page() {
  return (
    <LegalPage title="Cookie Notice" updated="21 November 2026">
      <p>PassOn uses only what's strictly needed to run the site. We use no advertising cookies.</p>
      <h2>Strictly necessary</h2>
      <ul>
        <li><strong>Sign-in session</strong> (browser local storage): keeps you signed in. Removed when you sign out.</li>
        <li><strong>Google sign-in</strong>: if you choose it, Google processes your sign-in under its own privacy policy.</li>
      </ul>
      <h2>Preferences</h2>
      <ul><li><strong>Language and theme</strong> (local storage): remembers your language and light/dark mode choice.</li></ul>
      <h2>Analytics</h2>
      <p>Our hosting provider records anonymous visit statistics without cookies and without identifying you. See the <Link to="/legal/privacy" className="underline">Privacy Policy</Link> for details.</p>
      <h2>Your control</h2>
      <p>You can clear site data in your browser at any time. This will sign you out and reset your preferences.</p>
    </LegalPage>
  );
}
