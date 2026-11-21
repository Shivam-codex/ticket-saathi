import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Download, FileText, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { getSellerEarnings } from "@/functions/earnings.functions";
import { downloadSellerFeeInvoicePdf, downloadSellerStatementPdf, type SellerPdfLabels } from "@/lib/seller-pdf";
import { formatINR } from "@/lib/event-filters";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/seller/earnings")({
  loader: () => getSellerEarnings(),
  head: () => ({ meta: [
    { title: "Seller earnings — PassOn" },
    { name: "description", content: "Track pending and released ticket proceeds, fees, GST and provider payouts." },
    { property: "og:title", content: "Seller earnings — PassOn" },
    { property: "og:description", content: "PassOn seller proceeds, statements and fee invoices." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: SellerEarningsPage,
});

function SellerEarningsPage() {
  const data = Route.useLoaderData();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const labels: SellerPdfLabels = {
    statementTitle: t("earnings.statement"), invoiceTitle: t("earnings.feeInvoice"), draft: t("invoice.draft"), order: t("order.number"), event: t("earnings.event"), status: t("earnings.status"),
    pending: t("earnings.pending"), subtotal: t("earnings.subtotal"), fee: t("earnings.fees"), gst: t("earnings.gst"), tcs: t("earnings.tcs"), tds: t("earnings.tds"), net: t("earnings.net"), payout: t("earnings.payout"), total: t("invoice.total"), compliance: t("earnings.compliance"),
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); toast.success(t("earnings.downloaded")); }
    catch { toast.error(t("earnings.downloadFailed")); }
    finally { setBusy(false); }
  };
  const cards = [
    [t("earnings.pending"), data.summary.pendingPaise],
    [t("earnings.released"), data.summary.releasedPaise],
    [t("earnings.fees"), data.summary.sellerFeesPaise],
    [t("earnings.gst"), data.summary.sellerGstPaise],
  ] as const;
  return <div className="mx-auto max-w-6xl px-4 py-8">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-3xl font-extrabold">{t("earnings.title")}</h1><p className="mt-1 text-sm text-muted-foreground">{t("earnings.subtitle")}</p></div><div className="flex gap-2">{data.isAdmin && <Button asChild variant="outline"><Link to="/admin/reconciliation">{t("recon.title")}</Link></Button>}<Button disabled={busy || !data.rows.length} onClick={() => run(() => downloadSellerStatementPdf(data.rows, data.summary, labels))}><Download className="h-4 w-4" />{t("earnings.statement")}</Button></div></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <section key={label} className="rounded-3xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-extrabold">{formatINR(value)}</p></section>)}</div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><section className="rounded-2xl bg-secondary p-4 text-sm"><b>{t("earnings.tcs")}</b>: {formatINR(data.summary.tcsPaise)} · <b>{t("earnings.tds")}</b>: {formatINR(data.summary.tdsPaise)}<p className="mt-1 text-xs text-muted-foreground">{t("earnings.taxNote")}</p></section><section className="flex gap-3 rounded-2xl border border-warning bg-card p-4 text-sm"><ShieldAlert className="h-5 w-5 shrink-0 text-primary" /><p>{t("earnings.compliance")}</p></section></div>
    <div className="mt-6 space-y-3">{data.rows.map((row) => <article key={row.orderId} className="rounded-3xl border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{row.eventTitle}</h2><p className="mt-1 text-xs text-muted-foreground">{row.feeInvoiceNumber} · {new Date(row.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" })}</p></div><div className="text-right"><Badge variant={row.payoutStatus === "paid" ? "default" : "secondary"}>{row.payoutStatus}</Badge><p className="mt-2 text-xl font-extrabold">{formatINR(row.sellerNetPaise)}</p></div></div><dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3"><div><dt className="text-muted-foreground">{t("earnings.subtotal")}</dt><dd>{formatINR(row.ticketSubtotalPaise)}</dd></div><div><dt className="text-muted-foreground">{t("earnings.fees")} + {t("earnings.gst")}</dt><dd>{formatINR(row.feeInvoiceTotalPaise)}</dd></div><div><dt className="text-muted-foreground">{t("earnings.tcs")} + {t("earnings.tds")}</dt><dd>{formatINR(row.tcsPaise)} · {formatINR(row.tdsPaise)}</dd></div></dl><div className="mt-4 flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link to="/orders/$orderId" params={{ orderId: row.orderId }}>{t("earnings.viewOrder")}</Link></Button><Button size="sm" variant="outline" disabled={busy || row.status === "refunded"} onClick={() => run(() => downloadSellerFeeInvoicePdf(row, labels))}><FileText className="h-4 w-4" />{t("earnings.feeInvoice")}</Button></div></article>)}{!data.rows.length && <p className="rounded-3xl border bg-card p-8 text-center text-muted-foreground">{t("earnings.empty")}</p>}</div>
  </div>;
}
