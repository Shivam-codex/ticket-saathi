import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Printer, ArrowLeft } from "lucide-react";
import { getOrder } from "@/functions/orders.functions";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/event-filters";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/orders/$orderId_/invoice")({
  loader: async ({ params }) => {
    const data = await getOrder({ data: { id: params.orderId } });
    if (!data || !data.order.invoice_number) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const title = loaderData?.order.invoice_number ? `Draft GST invoice ${loaderData.order.invoice_number} — PassOn` : "Invoice unavailable — PassOn";
    return { meta: [{ title }, { name: "description", content: "Draft GST invoice for the PassOn buyer platform fee." }, { property: "og:title", content: title }, { property: "og:description", content: "PassOn platform fee invoice." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] };
  },
  component: InvoicePage,
});

function InvoicePage() {
  const { order } = Route.useLoaderData();
  const { t } = useI18n();
  const fee = Number(order.buyer_fee_paise);
  const gst = Number(order.buyer_fee_gst_paise);
  const gstRate = fee > 0 ? (gst / fee) * 100 : 0;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 print:max-w-none print:p-0">
      <div className="mb-5 flex justify-between print:hidden"><Button asChild variant="ghost"><Link to="/orders/$orderId" params={{ orderId: order.id }}><ArrowLeft className="h-4 w-4" />{t("invoice.back")}</Link></Button><Button onClick={() => window.print()}><Printer className="h-4 w-4" />{t("invoice.print")}</Button></div>
      <article className="rounded-3xl border bg-card p-6 md:p-10 print:rounded-none print:border-0">
        <div className="rounded-xl border border-warning bg-secondary p-3 text-sm font-semibold print:border-foreground">{t("invoice.draft")}</div>
        <div className="mt-8 flex flex-wrap justify-between gap-6"><div><h1 className="text-3xl font-extrabold">PassOn</h1><p className="mt-2 text-sm text-muted-foreground">{t("invoice.legalName")}: PassOn</p><p className="text-sm text-muted-foreground">GSTIN: {t("invoice.notConfigured")}</p><p className="max-w-xs text-sm text-muted-foreground">{t("invoice.address")}: {t("invoice.notConfigured")}</p></div><div className="text-right"><h2 className="text-xl font-bold">{t("invoice.title")}</h2><p className="mt-2 font-mono text-sm">{order.invoice_number}</p><p className="text-sm text-muted-foreground">{order.invoice_issued_at && new Date(order.invoice_issued_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" })}</p></div></div>
        <div className="mt-8 grid gap-4 border-y py-5 text-sm sm:grid-cols-2"><div><h3 className="font-bold">{t("invoice.billTo")}</h3><p className="mt-2">{order.buyer_name}</p><p>{order.buyer_phone}</p><p>{t("invoice.placeSupply")}: {order.buyer_state_code || t("invoice.notConfigured")}</p></div><div><h3 className="font-bold">{t("invoice.orderRef")}</h3><p className="mt-2 break-all font-mono text-xs">{order.id}</p><p>{order.listings?.events?.title}</p></div></div>
        <table className="mt-8 w-full text-left text-sm"><thead><tr className="border-b"><th className="py-3">{t("invoice.description")}</th><th className="py-3 text-right">{t("invoice.amount")}</th></tr></thead><tbody><tr className="border-b"><td className="py-4">{t("invoice.platformFee")}</td><td className="py-4 text-right">{formatINR(fee)}</td></tr><tr className="border-b"><td className="py-4">{t("invoice.gst")} ({gstRate.toFixed(0)}%)</td><td className="py-4 text-right">{formatINR(gst)}</td></tr><tr className="text-lg font-bold"><td className="py-4">{t("invoice.total")}</td><td className="py-4 text-right">{formatINR(fee + gst)}</td></tr></tbody></table>
        <div className="mt-8 space-y-2 text-xs text-muted-foreground"><p>{t("invoice.scope")}</p><p>{t("invoice.ticketValue")}: {formatINR(Number(order.price_paise) * order.quantity)} · {t("invoice.buyerPaid")}: {formatINR(Number(order.total_paise))}</p><p>{t("invoice.paymentRef")}: {order.payment_ref ?? "—"}</p><p>{t("invoice.footer")}</p></div>
      </article>
    </div>
  );
}
