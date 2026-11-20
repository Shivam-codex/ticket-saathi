import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

// Legacy path from Phase 1 — search now lives on /events.
export const Route = createFileRoute("/search")({
  validateSearch: z.object({ q: z.string().optional() }),
  beforeLoad: ({ search }) => { throw redirect({ to: "/events", search: { q: search.q } }); },
});
