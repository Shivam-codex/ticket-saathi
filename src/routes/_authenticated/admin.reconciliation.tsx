import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { adminReconciliation, adminUpdateTaxConfig } from "@/functions/earnings.functions";
import { formatINR } from "@/lib/event-filters";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/reconciliation")({
  loader: () => adminReconciliation(),
  head: () => ({ meta: [
    { title: "Payment reconciliation — PassOn admin" },
    { name: "description", content: "Review balanced payment, refund and seller payout ledger entries." },
    { property: "og:title", content: "Payment reconciliation — PassOn admin" },
    { property: "og:description", content: "Double-entry ledger exceptions and tax hooks." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: ReconciliationPage,
});

function ReconciliationPage() {
  const data = Route.useLoaderData();
  const { t } = useI18n();
  const router = useRouter();
  const [enabled, setEnabled] = useState(data.tax.enabled);
  const [tcs, setTcs] = useState(String(data.tax.tcs_bps));
  const [tds, setTds] = useState(String(data.tax.tds_bps));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await adminUpdateTaxConfig({ data: { enabled, tcs_bps: Number(tcs), tds_bps: Number(tds) } }); toast.success(t("recon.taxSaved")); await router.invalidate(); }
    catch { toast.error(t("recon.taxFailed")); }
    finally { setBusy(false); }
  };
  return <div className="mx-auto max-w-6xl px-4 py-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-extrabold">{t("recon.title")}</h1><p className="mt-1 text-muted-foreground">{t("recon.subtitle")}</p></div><Badge variant={data.attention ? "destructive" : "default"}>{data.attention} {t("recon.attention")}</Badge></div>
    <section className="mt-6 rounded-3xl border bg-card p-6"><h2 className="text-xl font-bold">{t("recon.taxHooks")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("earnings.taxNote")}</p><div className="mt-4 grid gap-4 sm:grid-cols-3"><div><Label>{t("earnings.tcs")} (basis points)</Label><Input inputMode="numeric" value={tcs} onChange={(e) => setTcs(e.target.value.replace(/\D/g, ""))} /></div><div><Label>{t("earnings.tds")} (basis points)</Label><Input inputMode="numeric" value={tds} onChange={(e) => setTds(e.target.value.replace(/\D/g, ""))} /></div><label className="flex items-center justify-between rounded-xl border p-3"><span>{t("recon.enabled")}</span><Switch checked={enabled} onCheckedChange={setEnabled} /></label></div><Button className="mt-4" disabled={busy} onClick={save}>{t("settings.save")}</Button></section>
    <div className="mt-6 space-y-3">{data.rows.map((row) => <article key={row.orderId} className="rounded-2xl border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-mono text-sm">{row.orderId}</p><Badge variant={row.status === "balanced" ? "default" : "destructive"}>{t(row.status === "balanced" ? "recon.balanced" : "recon.attention")}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{t("earnings.net")}: {formatINR(row.expectedPayoutPaise)} · {t("earnings.released")}: {formatINR(row.actualPayoutPaise)}</p>{!!row.issues.length && <ul className="mt-3 list-disc pl-5 text-sm text-destructive">{row.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}</article>)}{!data.rows.length && <p className="rounded-3xl border bg-card p-8 text-center text-muted-foreground">{t("recon.empty")}</p>}</div>
  </div>;
}
