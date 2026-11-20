import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin } from "lucide-react";
import { formatINR, imageUrl } from "@/lib/event-filters";

export type EventCardData = {
  id: string | null; title: string | null; category: string | null; starts_at: string | null; image_url: string | null;
  venue_name: string | null; city: string | null; active_listings: number | null; from_price_paise: number | null; is_resellable: boolean | null;
};

export function EventCard({ e, priority = false }: { e: EventCardData; priority?: boolean }) {
  if (!e.id) return null;
  const src = imageUrl(e.image_url, 480, 270);
  return (
    <Link to="/events/$eventId" params={{ eventId: e.id }} className="group block overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-0.5 hover:shadow-ticket">
      <div className="relative aspect-video bg-muted">
        {src && (
          <img src={src} srcSet={`${imageUrl(e.image_url, 480, 270)} 480w, ${imageUrl(e.image_url, 800, 450)} 800w`} sizes="(min-width: 768px) 33vw, 100vw"
            alt="" width={480} height={270} loading={priority ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover" />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-0.5 text-xs font-semibold capitalize">{e.category}</span>
        {(e.active_listings ?? 0) > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">{e.active_listings} on sale</span>
        )}
      </div>
      <div className="p-4">
        <p className="line-clamp-2 font-bold leading-snug group-hover:text-primary">{e.title}</p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" />
          {e.starts_at && new Date(e.starts_at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{e.venue_name}, {e.city}</p>
        <div className="mt-3 flex items-end justify-between">
          {e.is_resellable ? <p className="text-sm">from <span className="font-display text-lg font-extrabold">{formatINR(e.from_price_paise)}</span></p>
            : <p className="text-sm font-medium text-destructive">Resale not allowed</p>}
        </div>
      </div>
    </Link>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card" aria-hidden>
      <div className="aspect-video animate-pulse bg-muted" />
      <div className="space-y-2 p-4"><div className="h-4 w-3/4 animate-pulse rounded bg-muted" /><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /><div className="h-3 w-2/3 animate-pulse rounded bg-muted" /></div>
    </div>
  );
}

export function EventGridSkeleton({ n = 6 }: { n?: number }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: n }, (_, i) => <EventCardSkeleton key={i} />)}</div>;
}
