import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n, type TKey } from "@/lib/i18n";
import { formatINR } from "@/lib/event-filters";
import { myListings, quoteListing, updateListing } from "@/functions/listings.functions";
import { FairHint } from "@/components/listings/FairHint";

export const Route = createFileRoute("/_authenticated/my-listings")({
  head: () => ({ meta: [
    { title: "My listings — PassOn" },
    { name: "description", content: "Manage the tickets you are selling on PassOn: edit price, pause or cancel." },
    { property: "og:title", content: "My listings — PassOn" },
    { property: "og:description", content: "Manage the tickets you are selling on PassOn." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: () => myListings(),
  component: MyListings,
});

type Row = Awaited<ReturnType<typeof myListings>>[number];

function statusKey(r: Row): TKey {
  if (r.status === "draft" && r.is_paused) return "ml.status.paused";
  if (r.status === "draft") return r.verification_status === "review" ? "ml.status.review" : "ml.status.pending";
  return `ml.status.${r.status}` as TKey;
}

function MyListings() {
  const { t } = useI18n();
  const rows = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between gap-3"><h1 className="text-3xl font-extrabold">{t("ml.title")}</h1><div className="flex gap-2"><Button asChild variant="outline"><Link to="/seller/earnings">{t("nav.earnings")}</Link></Button><Button asChild><Link to="/sell">{t("hero.cta.sell")}</Link></Button></div></div>
      <ul className="mt-6 space-y-3">
        {rows.map((r) => <ListingRow key={r.id} r={r} />)}
        {!rows.length && <li className="rounded-3xl border bg-card p-6 text-muted-foreground">{t("ml.empty")}</li>}
      </ul>
    </div>
  );
}

function ListingRow({ r }: { r: Row }) {
  const { t } = useI18n();
  const router = useRouter();
  const update = useServerFn(updateListing);
  const quoteFn = useServerFn(quoteListing);
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(String(Number(r.price_paise) / 100));
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof quoteListing>> | null>(null);
  const [busy, setBusy] = useState(false);
  const editable = r.status === "draft" || r.status === "active";

  const run = async (data: { id: string; action: "pause" | "resume" | "cancel" } | { id: string; action: "price"; price_paise: number }) => {
    setBusy(true);
    try {
      const res = await update({ data });
      if (!res.ok) toast.error(res.message); else { toast.success(t("ml.saved")); setEditing(false); await router.invalidate(); }
    } finally { setBusy(false); }
  };
  const onPrice = async (v: string) => {
    setPrice(v);
    const p = Math.round(Number(v) * 100);
    if (p > 0) setQuote(await quoteFn({ data: { event_id: r.event_id, section: r.section ?? undefined, quantity: r.quantity, face_value_paise: Number(r.face_value_paise), price_paise: p, listing_id: r.id } }).catch(() => null));
  };

  return (
    <li className="rounded-3xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">{r.events?.title}</p>
          <p className="text-sm text-muted-foreground">{[r.section, r.seat_info].filter(Boolean).join(" · ")} · ×{r.quantity}</p>
          {r.events?.starts_at && <p className="text-xs text-muted-foreground">{new Date(r.events.starts_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST</p>}
        </div>
        <div className="text-right">
          <Badge variant={r.status === "active" ? "default" : "secondary"}>{t(statusKey(r))}</Badge>
          <p className="mt-1 text-lg font-extrabold">{formatINR(Number(r.price_paise))}</p>
          <p className="text-xs text-muted-foreground">{t("sell.face")}: {formatINR(Number(r.face_value_paise))}</p>
        </div>
      </div>
      {r.block_reason && <p className="mt-2 text-sm text-muted-foreground">{r.block_reason}</p>}
      {editable && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>{t("ml.editPrice")}</Button>
          {r.status === "active" && <Button size="sm" variant="outline" disabled={busy} onClick={() => run({ id: r.id, action: "pause" })}>{t("ml.pause")}</Button>}
          {r.status === "draft" && r.is_paused && <Button size="sm" variant="outline" disabled={busy} onClick={() => run({ id: r.id, action: "resume" })}>{t("ml.resume")}</Button>}
          <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => { if (confirm(t("ml.cancelConfirm"))) run({ id: r.id, action: "cancel" }); }}>{t("ml.cancel")}</Button>
        </div>
      )}
      {editing && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2"><Input inputMode="decimal" value={price} onChange={(e) => onPrice(e.target.value.replace(/[^\d.]/g, ""))} aria-label={t("sell.price")} /><Button disabled={busy} onClick={() => run({ id: r.id, action: "price", price_paise: Math.round(Number(price) * 100) })}>{t("settings.save")}</Button></div>
          {quote?.capPaise != null && <p className="text-xs text-muted-foreground">{t("sell.maxAllowed")}: <b>{formatINR(quote.capPaise)}</b></p>}
          {quote && !quote.ok && <ul className="list-disc pl-5 text-sm text-destructive">{quote.reasons.map((x) => <li key={x.message}>{x.message}</li>)}</ul>}
          {quote && <FairHint quote={quote} />}
        </div>
      )}
    </li>
  );
}
