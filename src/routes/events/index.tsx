import { createFileRoute, Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { searchEvents } from "@/functions/events.functions";
import { CATEGORIES, CITIES, eventSearchSchema, PAGE_SIZE, WHEN, type EventSearch } from "@/lib/event-filters";
import { EventCard, EventGridSkeleton } from "@/components/events/EventCard";
import { SearchBar } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLiveListings } from "@/hooks/use-live-listings";

const eventsQuery = (s: EventSearch) => queryOptions({ queryKey: ["events", "list", s], queryFn: () => searchEvents({ data: s }), staleTime: 60_000 });

export const Route = createFileRoute("/events/")({
  validateSearch: eventSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(eventsQuery(deps)),
  head: () => ({
    meta: [
      { title: "Events & resale tickets — PassOn" },
      { name: "description", content: "Browse movies, matches and concerts in Pune, Mumbai, Delhi and Bengaluru. Filter by city, date and price." },
      { property: "og:title", content: "Events & resale tickets — PassOn" },
      { property: "og:description", content: "Find fair-priced resale tickets near you." },
    ],
  }),
  pendingMs: 300,
  pendingComponent: () => <div className="mx-auto max-w-6xl px-4 py-8"><EventGridSkeleton /></div>,
  errorComponent: ({ error }) => <p className="mx-auto max-w-6xl px-4 py-10 text-destructive">{error instanceof Error ? error.message : "Something went wrong"}</p>,
  component: EventsPage,
});

const ALL = "__all";
const WHEN_LABEL: Record<(typeof WHEN)[number], string> = { today: "Today", weekend: "This weekend", week: "Next 7 days", month: "Next 30 days" };
const PRICES = [500, 1000, 2000, 5000];

function EventsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/events/" });
  const data = Route.useLoaderData();
  const router = useRouter();
  const isFetching = useRouterState({ select: (s) => s.isLoading });
  useLiveListings(() => { router.options.context.queryClient.invalidateQueries({ queryKey: ["events", "list"] }); router.invalidate(); });

  const set = (patch: Partial<EventSearch>) => navigate({ search: (p) => ({ ...p, ...patch, page: undefined }) });
  const applyInterpreted = () => data?.interpreted && navigate({ search: { ...data.interpreted, ai: "0" } });
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const page = search.page ?? 1;
  const it = data?.interpreted as (Partial<EventSearch> | null | undefined);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <SearchBar className="mb-4" />
      <div className="flex flex-wrap gap-2">
        <Select value={search.city ?? ALL} onValueChange={(v) => set({ city: v === ALL ? undefined : v })}>
          <SelectTrigger className="w-36" aria-label="City"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>All cities</SelectItem>{CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={search.category ?? ALL} onValueChange={(v) => set({ category: v === ALL ? undefined : (v as EventSearch["category"]) })}>
          <SelectTrigger className="w-36 capitalize" aria-label="Category"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>All categories</SelectItem>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c === "movie" ? "Movies" : c === "concert" ? "Concerts" : "Sports"}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={search.when ?? ALL} onValueChange={(v) => set({ when: v === ALL ? undefined : (v as EventSearch["when"]), from: undefined, to: undefined })}>
          <SelectTrigger className="w-40" aria-label="Date"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Any date</SelectItem>{WHEN.map((w) => <SelectItem key={w} value={w}>{WHEN_LABEL[w]}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={search.maxPrice ? String(search.maxPrice) : ALL} onValueChange={(v) => set({ maxPrice: v === ALL ? undefined : Number(v) })}>
          <SelectTrigger className="w-36" aria-label="Max price"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Any price</SelectItem>{PRICES.map((p) => <SelectItem key={p} value={String(p)}>Under ₹{p.toLocaleString("en-IN")}</SelectItem>)}
            {search.maxPrice && !PRICES.includes(search.maxPrice) && <SelectItem value={String(search.maxPrice)}>Under ₹{search.maxPrice.toLocaleString("en-IN")}</SelectItem>}</SelectContent>
        </Select>
        {(search.city || search.category || search.when || search.maxPrice || search.q || search.from) && (
          <Button variant="ghost" asChild><Link to="/events" search={{}}><X className="h-4 w-4" />Clear</Link></Button>
        )}
      </div>

      {data?.source === "ai" && it && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-secondary p-3 text-sm">
          <Sparkles className="h-4 w-4 text-accent" /><span className="font-semibold">Understood as:</span>
          {[it.city, it.category, it.q && `“${it.q}”`, it.maxPrice && `under ₹${it.maxPrice.toLocaleString("en-IN")}`, it.from && (it.to && it.to !== it.from ? `${it.from} → ${it.to}` : it.from)].filter(Boolean).map((c) => (
            <span key={String(c)} className="rounded-full bg-card px-2.5 py-0.5 capitalize">{c}</span>
          ))}
          {Object.keys(it).length === 0 && <span className="text-muted-foreground">all upcoming events</span>}
          <button className="ml-auto text-xs underline" onClick={applyInterpreted}>Edit filters</button>
        </div>
      )}
      {data?.source === "keyword" && search.q && <p className="mt-4 text-sm text-muted-foreground">Showing keyword matches for “{search.q}”.</p>}

      <h1 className="mt-6 text-2xl font-extrabold">{data ? `${data.total} event${data.total === 1 ? "" : "s"}` : "Events"}</h1>
      <div className={`mt-4 transition-opacity ${isFetching ? "opacity-60" : ""}`}>
        {!data ? <EventGridSkeleton /> : data.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">No events match. Try fewer filters.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.items.map((e, i) => <EventCard key={e.id} e={e} priority={i < 3} />)}</div>
        )}
      </div>
      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
          <Button variant="outline" disabled={page <= 1} onClick={() => navigate({ search: (p) => ({ ...p, page: page - 1 }) })}>Previous</Button>
          <span className="text-sm">Page {page} of {pages}</span>
          <Button variant="outline" disabled={page >= pages} onClick={() => navigate({ search: (p) => ({ ...p, page: page + 1 }) })}>Next</Button>
        </nav>
      )}
    </div>
  );
}
