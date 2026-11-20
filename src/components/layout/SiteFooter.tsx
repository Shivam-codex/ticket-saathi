import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useI18n();
  const links = [
    { to: "/legal/terms", label: t("legal.terms") },
    { to: "/legal/refund-policy", label: t("legal.refund") },
    { to: "/legal/privacy", label: t("legal.privacy") },
    { to: "/legal/grievance", label: t("legal.grievance") },
    { to: "/legal/cookies", label: t("legal.cookies") },
  ] as const;
  return (
    <footer className="mt-16 border-t bg-ink text-ink-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-28 pt-10 md:grid-cols-3 md:pb-10">
        <div>
          <p className="font-display text-2xl font-extrabold">PassOn</p>
          <p className="mt-2 text-sm opacity-75">{t("footer.tag")}</p>
        </div>
        <nav aria-label={t("footer.legal")} className="md:col-span-2">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider opacity-60">{t("footer.legal")}</p>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {links.map((l) => <li key={l.to}><Link to={l.to} className="opacity-85 hover:text-primary hover:opacity-100">{l.label}</Link></li>)}
          </ul>
          <p className="mt-6 text-xs opacity-60">PassOn is an intermediary marketplace. Tickets are sold by independent sellers who warrant they are genuine. © {new Date().getFullYear()} PassOn.</p>
        </nav>
      </div>
    </footer>
  );
}
