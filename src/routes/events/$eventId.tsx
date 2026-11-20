import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { CalendarDays, MapPin, ShieldCheck, Ban, Radio } from "lucide-react";
import { getEvent } from "@/functions/events.functions";
import { formatINR, imageUrl } from "@/lib/event-filters";
import { useLiveListings } from "@/hooks/use-live-listings";
import { Button } from "@/components/ui/button";

const eventQuery = (id: string) => queryOptions({ queryKey: ["event", id], queryFn: () => getEvent({ data: { id } }) });

export const Route = createFileRoute("/events/$eventId")({
  loader: async ({ context, params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.eventId)) throw notFound();
    const d = await context.queryClient.ensureQueryData(eventQuery(params.eventId));
    if (!d) throw notFound();
    return d;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Event unavailable — PassOn" }, { name: "robots", content: "noindex" }] };
    const e = loaderData.event;
    const when = new Date(e.starts_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
    const title = `${e.title} tickets — ${e.venues?.city ?? ""} | PassOn`;
    const desc = `${loaderData.listings.length} resale ticket${loaderData.listings.length === 1 ? "" : "s"} for ${e.title} at ${e.venues?.name}, ${when}. Face-value cap and Buyer Protection.`;
    const og = imageUrl(e.image_url, 1200, 630);
    return {
      meta: [
        { title }, { name: "description", content: desc },
        { property: "og:title", content: title }, { property: "og:description", content: desc },
        { property: "og:type", content: "website" }, { property: "og:url", content: `/events/${params.eventId}` },
        ...(og ? [{ property: "og:image", content: og }, { name: "twitter:image", content: og }] : []),
      ],
      links: [{ rel: "canonical", href: `/events/${params.eventId}` }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify({
        "@context": "https://schema.org", "@type": "Event", name: e.title, startDate: e.starts_at, image: og,
        location: { "@type": "Place", name: e.venues?.name, address: `${e.venues?.address ?? ""}, ${e.venues?.city ?? ""}` },
        organizer: e.organizer ? { "@type": "Organization", name: e.organizer } : undefined,
      }) }],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-4 py-16 text-center"><h1 className="text-2xl font-bold">Event not found</h1><Link to="/events" className="mt-4 inline-block underline">Browse events</Link></div>
  ),
  errorComponent: ({ error }) => <p className="mx-auto max-w-3xl px-4 py-10 text-destructive">{error instanceof Error ? error.message : "Something went wrong"}</p>,
  component: EventPage,
});

function EventPage() {
  const { eventId } = Route.useParams();
  const data = Route.useLoaderData();
  const router = useRouter();
  useLiveListings(() => { router.options.context.queryClient.invalidateQueries({ queryKey: ["event", eventId] }); router.invalidate(); }, eventId);
  const { event: e, listings } = data;
  const capNote = e.resale_max_percent != null ? `Resale capped at ${e.resale_max_percent}% of face value for this event.` : "Resale capped at face value.";
  return (
    <div>
      <div className="relative h-56 bg-muted md:h-80">
        {e.image_url && <img src={imageUrl(e.image_url, 1600, 640)} srcSet={`${imageUrl(e.image_url, 800, 400)} 800w, ${imageUrl(e.image_url, 1600, 640)} 1600w`} sizes="100vw" alt={e.title} width={1600} height={640} fetchPriority="high" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      </div>
      <div className="mx-auto -mt-20 max-w-5xl px-4">
        <div className="relative rounded-3xl border bg-card p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{e.category}</p>
          <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">{e.title}</h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{new Date(e.starts_at).toLocaleString("en-IN", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{e.venues?.name}, {e.venues?.city}</span>
          </div>
          {e.description && <p className="mt-4 max-w-2xl">{e.description}</p>}
          {e.organizer && <p className="mt-2 text-sm text-muted-foreground">Organiser: {e.organizer}</p>}
          {e.face_value_tiers.length > 0 && (
            <div className="mt-5"><p className="text-sm font-semibold">Face value</p>
              <div className="mt-2 flex flex-wrap gap-2">{e.face_value_tiers.map((t) => <span key={t.name} className="rounded-full bg-secondary px-3 py-1 text-sm">{t.name} · {formatINR(t.price_paise)}</span>)}</div>
            </div>
          )}
        </div>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-extrabold">Tickets on sale</h2>
            <span className="inline-flex items-center gap-1.5 text-xs text-success"><Radio className="h-3.5 w-3.5 animate-pulse" />Live · {listings.length}</span>
          </div>
          {!e.is_resellable ? (
            <p className="mt-4 flex items-start gap-3 rounded-2xl border border-destructive/40 p-5 text-sm"><Ban className="h-5 w-5 text-destructive" />The organiser does not allow ticket transfer for this event, so it can't be listed on PassOn.</p>
          ) : listings.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed p-8 text-center">
              <p className="text-muted-foreground">No tickets listed yet. Have one you can't use?</p>
              <Button asChild className="mt-4"><Link to="/sell">Sell your ticket</Link></Button>
            </div>
          ) : (
            <ul className="mt-4 divide-y rounded-2xl border bg-card">
              {listings.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-4 p-4">
                  <div><p className="font-semibold">{l.section ?? "General"}{l.seat_info ? ` · ${l.seat_info}` : ""}</p>
                    <p className="text-sm text-muted-foreground">{l.quantity} ticket{l.quantity > 1 ? "s" : ""} · face value {formatINR(l.face_value_paise)}</p></div>
                  <div className="text-right"><p className="font-display text-xl font-extrabold">{formatINR(l.price_paise)}</p><p className="text-xs text-muted-foreground">each, before fees</p></div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-accent" />{capNote} Buyer Protection on every order. The full price, including fees and GST, is shown before you pay.</p>
        </section>
      </div>
    </div>
  );
}
