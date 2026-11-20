import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CalendarDays, MapPin } from "lucide-react";
import { searchEvents } from "@/functions/events.functions";
import { SearchBar } from "@/components/layout/SiteHeader";

const eventsQuery = (q?: string) => queryOptions({ queryKey: ["events", q ?? ""], queryFn: () => searchEvents({ data: { q } }) });

export const Route = createFileRoute("/search")({
  validateSearch: z.object({ q: z.string().optional() }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(eventsQuery(deps.q)),
  head: () => ({
    meta: [
      { title: "Search events — PassOn" },
      { name: "description", content: "Find resale tickets for upcoming movies, matches and concerts across India." },
      { property: "og:title", content: "Search events — PassOn" },
      { property: "og:description", content: "Find resale tickets for upcoming movies, matches and concerts." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const { data } = useSuspenseQuery(eventsQuery(q));
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <SearchBar className="mb-6 md:hidden" />
      <h1 className="text-3xl font-extrabold">{q ? `Results for “${q}”` : "Upcoming events"}</h1>
      {data.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed p-8 text-center text-muted-foreground">No events yet. Events are added by our team — check back soon.</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {data.map((e) => (
            <li key={e.id} className="rounded-2xl border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">{e.category}</p>
              <p className="mt-1 text-lg font-bold">{e.title}</p>
              <p className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" />{new Date(e.starts_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                {e.venues && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{e.venues.name}, {e.venues.city}</span>}
              </p>
              {!e.is_resellable && <p className="mt-2 text-sm font-medium text-destructive">Organizer does not allow resale for this event.</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
