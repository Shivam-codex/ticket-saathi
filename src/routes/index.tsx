import type React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BadgeIndianRupee, ShieldCheck, Receipt, Film, Trophy, Music, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { CITIES } from "@/lib/event-filters";
import { getHomeSections } from "@/functions/events.functions";
import { EventCard, EventCardSkeleton, type EventCardData } from "@/components/events/EventCard";
import { useLiveListings } from "@/hooks/use-live-listings";

const homeQuery = (city?: string) => queryOptions({ queryKey: ["events", "home", city ?? ""], queryFn: () => getHomeSections({ data: { city } }) });

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(homeQuery()),
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

function Row({ title, items, cta, loading }: { title: string; items: EventCardData[]; cta: React.ReactNode; loading?: boolean }) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-end justify-between gap-4"><h2 className="text-2xl font-extrabold">{title}</h2>{cta}</div>
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {loading ? Array.from({ length: 4 }, (_, i) => <div key={i} className="w-72 shrink-0"><EventCardSkeleton /></div>)
          : items.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">Nothing here yet.</p>
          : items.map((e, i) => <div key={e.id} className="w-72 shrink-0 snap-start"><EventCard e={e} priority={i < 2} /></div>)}
      </div>
    </section>
  );
}

function Index() {
  const { t } = useI18n();
  const [city, setCity] = useState<string | undefined>(undefined);
  useEffect(() => { const c = localStorage.getItem("passon.city"); if (c) setCity(c); }, []);
  const pick = (c: string) => { setCity(c); localStorage.setItem("passon.city", c); };
  const initial = Route.useLoaderData();
  const qc = useQueryClient();
  const { data, isFetching } = useQuery({ ...homeQuery(city), ...(city ? { placeholderData: (p: typeof initial | undefined) => p } : { initialData: initial }) });
  useLiveListings(() => qc.invalidateQueries({ queryKey: ["events", "home"] }));

  const trust = [
    { icon: ShieldCheck, title: t("trust.protection"), d: t("trust.protection.d") },
    { icon: BadgeIndianRupee, title: t("trust.cap"), d: t("trust.cap.d") },
    { icon: Receipt, title: t("trust.fees"), d: t("trust.fees.d") },
  ];
  const cats = [{ icon: Film, label: "Movies", v: "movie" }, { icon: Trophy, label: "Sports", v: "sports" }, { icon: Music, label: "Concerts", v: "concert" }] as const;
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="grid items-center gap-10 py-10 md:grid-cols-2 md:py-16">
        <div>
          <h1 className="text-4xl font-extrabold leading-[1.05] md:text-6xl">{t("hero.title")}</h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">{t("hero.sub")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="shadow-ticket"><Link to="/events">{t("hero.cta.buy")}</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/sell">{t("hero.cta.sell")}</Link></Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {cats.map(({ icon: Icon, label, v }) => (
            <Link key={v} to="/events" search={{ category: v }} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl bg-secondary font-semibold hover:bg-primary hover:text-primary-foreground">
              <Icon className="h-7 w-7" />{label}
            </Link>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Your city">
        <span className="text-sm text-muted-foreground">Near me:</span>
        {CITIES.map((c) => (
          <button key={c} onClick={() => pick(c)} aria-pressed={city === c}
            className="rounded-full border px-3 py-1 text-sm aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground">{c}</button>
        ))}
      </div>

      <Row title="Trending" items={data?.trending ?? []} loading={!data} cta={<Link to="/events" className="inline-flex items-center gap-1 text-sm font-semibold text-accent">See all <ArrowRight className="h-4 w-4" /></Link>} />
      <Row title={city ? `Near you in ${city}` : "Coming up"} items={data?.near ?? []} loading={!data || isFetching && !data.near.length}
        cta={<Link to="/events" search={city ? { city } : {}} className="inline-flex items-center gap-1 text-sm font-semibold text-accent">See all <ArrowRight className="h-4 w-4" /></Link>} />
      <Row title="This weekend" items={data?.weekend ?? []} loading={!data}
        cta={<Link to="/events" search={{ when: "weekend", ...(city ? { city } : {}) }} className="inline-flex items-center gap-1 text-sm font-semibold text-accent">See all <ArrowRight className="h-4 w-4" /></Link>} />

      <section className="mt-14 grid gap-4 md:grid-cols-3">
        {trust.map(({ icon: Icon, title, d }) => (
          <div key={title} className="rounded-2xl border bg-card p-6"><Icon className="h-7 w-7 text-accent" /><h2 className="mt-3 text-lg font-bold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{d}</p></div>
        ))}
      </section>
    </div>
  );
}
