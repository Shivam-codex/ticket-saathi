import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/event-filters";
import { adminDecideListing, adminReviewQueue } from "@/functions/listings.functions";

export const Route = createFileRoute("/_authenticated/admin/reviews")({
  head: () => ({ meta: [
    { title: "Ticket review queue — PassOn admin" },
    { name: "description", content: "Review tickets flagged by automatic verification." },
    { property: "og:title", content: "Ticket review queue — PassOn admin" },
    { property: "og:description", content: "Review tickets flagged by automatic verification." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: () => adminReviewQueue(),
  component: Reviews,
});

function Reviews() {
  const rows = Route.useLoaderData();
  const router = useRouter();
  const decide = useServerFn(adminDecideListing);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const act = async (id: string, decision: "approve" | "reject") => {
    const note = notes[id];
    const res = await decide({ data: { id, decision, ...(note ? { note } : {}) } });
    if (!res.ok) toast.error(res.message); else { toast.success(decision === "approve" ? "Approved — listing is live" : "Rejected"); await router.invalidate(); }
  };
  return (
    <div>
      <h1 className="text-2xl font-extrabold">Ticket review queue ({rows.length})</h1>
      <ul className="mt-4 space-y-4">
        {rows.map((r) => {
          const checks = (r.listing_secrets?.checks ?? {}) as { flags?: string[]; name?: string; date?: string; seat?: string };
          const ex = (r.listing_secrets?.extracted ?? {}) as Record<string, unknown>;
          return (
            <li key={r.id} className="grid gap-4 rounded-3xl border bg-card p-5 md:grid-cols-[1fr_280px]">
              <div className="space-y-2 text-sm">
                <p className="text-lg font-bold">{r.events?.title}</p>
                <p>{[r.section, r.seat_info].filter(Boolean).join(" · ")} · ×{r.quantity} · paid {formatINR(Number(r.face_value_paise))} · asking {formatINR(Number(r.price_paise))}</p>
                <p><b>Trust score:</b> {r.trust_score ?? "—"} / 100 · <b>Code source:</b> {r.listing_secrets?.qr_source ?? "none"}</p>
                <p><b>Match:</b> name {checks.name}, date {checks.date}, seat {checks.seat}</p>
                <div className="flex flex-wrap gap-1">{(checks.flags ?? []).map((f) => <span key={f} className="rounded-full bg-warning/20 px-2 py-0.5 text-xs">{f.replaceAll("_", " ")}</span>)}</div>
                <details><summary className="cursor-pointer text-muted-foreground">Extracted text</summary><pre className="mt-2 overflow-auto rounded-xl bg-secondary p-3 text-xs">{JSON.stringify(ex, null, 2)}</pre></details>
                <Input placeholder="Note to seller (optional, shown on reject)" value={notes[r.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
                <div className="flex gap-2"><Button onClick={() => act(r.id, "approve")}>Approve</Button><Button variant="destructive" onClick={() => act(r.id, "reject")}>Reject</Button></div>
              </div>
              <div>
                {r.file_url ? (r.listing_secrets?.file_mime === "application/pdf"
                  ? <a href={r.file_url} target="_blank" rel="noreferrer" className="text-primary underline">Open ticket PDF</a>
                  : <a href={r.file_url} target="_blank" rel="noreferrer"><img src={r.file_url} alt="Uploaded ticket" className="max-h-80 w-full rounded-xl border object-contain" /></a>)
                  : <p className="text-muted-foreground">File unavailable</p>}
              </div>
            </li>
          );
        })}
        {!rows.length && <li className="text-muted-foreground">Nothing to review.</li>}
      </ul>
    </div>
  );
}
