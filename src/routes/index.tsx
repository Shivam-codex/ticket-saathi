import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeIndianRupee, ShieldCheck, Receipt, Film, Trophy, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PassOn — Resell tickets fairly in India" },
      { name: "description", content: "Can't attend? Resell movie, cricket and concert tickets at or below face value, with Buyer Protection and no hidden fees." },
      { property: "og:title", content: "PassOn — Resell tickets fairly in India" },
      { property: "og:description", content: "Genuine tickets, face-value cap, full price upfront. Buyer Protection on every order." },
    ],
  }),
  component: Index,
});

function Index() {
  const { t } = useI18n();
  const trust = [
    { icon: ShieldCheck, title: t("trust.protection"), d: t("trust.protection.d") },
    { icon: BadgeIndianRupee, title: t("trust.cap"), d: t("trust.cap.d") },
    { icon: Receipt, title: t("trust.fees"), d: t("trust.fees.d") },
  ];
  const cats = [{ icon: Film, label: "Movies" }, { icon: Trophy, label: "Sports" }, { icon: Music, label: "Concerts" }];
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="grid items-center gap-10 py-12 md:grid-cols-2 md:py-20">
        <div>
          <h1 className="text-4xl font-extrabold leading-[1.05] md:text-6xl">{t("hero.title")}</h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">{t("hero.sub")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="shadow-ticket"><Link to="/search" search={{ q: undefined }}>{t("hero.cta.buy")}</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/sell">{t("hero.cta.sell")}</Link></Button>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-sm" aria-hidden>
          <div className="ticket-edge rotate-[-4deg] rounded-2xl bg-ticket p-6 text-primary-foreground shadow-ticket">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Admit one · Stand B</p>
            <p className="mt-2 font-display text-3xl font-extrabold">MI vs CSK</p>
            <p className="text-sm opacity-80">Wankhede, Mumbai · Sat 7:30 PM</p>
            <div className="mt-6 flex items-end justify-between border-t border-dashed border-current/30 pt-4">
              <div><p className="text-xs opacity-70">Face value</p><p className="text-lg font-bold line-through opacity-60">₹2,500</p></div>
              <div className="text-right"><p className="text-xs opacity-70">Resale</p><p className="font-display text-2xl font-extrabold">₹2,200</p></div>
            </div>
          </div>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {trust.map(({ icon: Icon, title, d }) => (
          <div key={title} className="rounded-2xl border bg-card p-6">
            <Icon className="h-7 w-7 text-accent" />
            <h2 className="mt-3 text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
      <section className="mt-12 grid grid-cols-3 gap-3">
        {cats.map(({ icon: Icon, label }) => (
          <Link key={label} to="/search" search={{ q: undefined }} className="flex flex-col items-center gap-2 rounded-2xl bg-secondary p-5 font-semibold hover:bg-primary hover:text-primary-foreground">
            <Icon className="h-6 w-6" />{label}
          </Link>
        ))}
      </section>
    </div>
  );
}
