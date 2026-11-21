import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "react-qr-code";
import { CheckCircle2, Download, FileText, QrCode, ShieldCheck, Smartphone, Star } from "lucide-react";
import { toast } from "sonner";
import { cancelCheckout, completeMockPayment, confirmOrderCompleted, confirmRazorpayPayment, getMockPaymentSession, getOrder, reviewSeller, startRazorpayPayment } from "@/functions/orders.functions";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { DisputePanel } from "@/components/trust/DisputePanel";
import { GatePassActions } from "@/components/orders/GatePassActions";
import { canRaiseDispute } from "@/lib/trust-rules";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatINR } from "@/lib/event-filters";
import { useI18n } from "@/lib/i18n";

type RazorpayCheckout = { open: () => void; on: (event: string, callback: (response: unknown) => void) => void };
declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout }
}

async function loadRazorpayCheckout(): Promise<void> {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Razorpay Checkout"));
    document.head.appendChild(script);
  });
}

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  loader: async ({ params }) => {
    const data = await getOrder({ data: { id: params.orderId } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `Order ${loaderData.order.id.slice(0, 8)} — PassOn` : "Order unavailable — PassOn";
    return { meta: [{ title }, { name: "description", content: "Track your PassOn order, mock UPI payment, ticket delivery and invoice." }, { property: "og:title", content: title }, { property: "og:description", content: "PassOn order details." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] };
  },
  component: OrderPage,
});

function OrderPage() {
  const data = Route.useLoaderData();
  const { order, history, ticket, isBuyer } = data;
  const { t } = useI18n();
  const router = useRouter();
  const sessionFn = useServerFn(getMockPaymentSession);
  const payFn = useServerFn(completeMockPayment);
  const startRazorpayFn = useServerFn(startRazorpayPayment);
  const confirmRazorpayFn = useServerFn(confirmRazorpayPayment);
  const cancelFn = useServerFn(cancelCheckout);
  const completeFn = useServerFn(confirmOrderCompleted);
  const reviewFn = useServerFn(reviewSeller);
  const [session, setSession] = useState<Awaited<ReturnType<typeof getMockPaymentSession>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(() => order.hold_expires_at ? Math.max(0, Math.floor((new Date(order.hold_expires_at).getTime() - Date.now()) / 1000)) : 0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (order.status !== "payment_pending") return;
    const timer = window.setInterval(() => setSeconds(order.hold_expires_at ? Math.max(0, Math.floor((new Date(order.hold_expires_at).getTime() - Date.now()) / 1000)) : 0), 1000);
    return () => window.clearInterval(timer);
  }, [order.status, order.hold_expires_at]);
  useEffect(() => {
    if (order.status === "payment_pending" && seconds === 0) void router.invalidate();
  }, [seconds, order.status, router]);

  const refresh = async () => { await router.invalidate(); };
  const showPayment = async () => {
    setBusy(true);
    try { setSession(await sessionFn({ data: { order_id: order.id } })); }
    catch (error) { toast.error(error instanceof Error ? error.message : t("pay.failed")); await refresh(); }
    finally { setBusy(false); }
  };
  const pay = async (outcome: "success" | "failure") => {
    if (!session) return;
    setBusy(true);
    try {
      const result = await payFn({ data: { order_id: order.id, reference: session.reference, outcome } });
      toast.success(result.status === "cancelled" ? t("pay.released") : t("pay.success"));
      setSession(null); await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : t("pay.failed")); }
    finally { setBusy(false); }
  };
  const confirmRazorpay = async () => {
    setBusy(true);
    try {
      const result = await confirmRazorpayFn({ data: { order_id: order.id } });
      if (["ticket_delivered", "completed"].includes(result.status)) toast.success(t("pay.confirmed"));
      if (result.status === "refunded") toast.success(t("pay.lateRefunded"));
      await refresh();
    } catch { toast.error(t("pay.failed")); }
    finally { setBusy(false); }
  };
  const startRazorpay = async () => {
    setBusy(true);
    try {
      const config = await startRazorpayFn({ data: { order_id: order.id } });
      if (!config.keyId) throw new Error("Razorpay key unavailable");
      await loadRazorpayCheckout();
      if (!window.Razorpay) throw new Error("Razorpay Checkout unavailable");
      const checkout = new window.Razorpay({
        key: config.keyId,
        order_id: config.providerOrderId,
        amount: config.amountPaise,
        currency: config.currency,
        name: "PassOn",
        description: order.listings?.events?.title ?? "Ticket order",
        prefill: { name: config.buyerName, contact: config.buyerPhone },
        notes: { orderId: order.id },
        handler: () => { void confirmRazorpay(); },
        modal: { ondismiss: () => { void confirmRazorpay(); } },
      });
      checkout.on("payment.failed", () => toast.error(t("pay.failed")));
      checkout.open();
    } catch (error) { toast.error(error instanceof Error ? error.message : t("pay.failed")); }
    finally { setBusy(false); }
  };
  const action = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try { await fn(); toast.success(message); await refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : t("pay.failed")); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{t("order.number")} #{order.id.slice(0, 8).toUpperCase()}</p><h1 className="mt-1 text-3xl font-extrabold">{order.listings?.events?.title}</h1><p className="mt-1 text-muted-foreground">{[order.listings?.section, order.listings?.seat_info].filter(Boolean).join(" · ")} · {order.quantity} {t("buy.tickets")}</p></div><OrderStatusBadge status={order.status} /></div>

      {order.status === "payment_pending" && <div className="mt-5 rounded-2xl border border-warning bg-card p-4 text-sm"><b>{t("order.reserved")}</b> · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</div>}

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {isBuyer && order.status === "payment_pending" && order.payment_provider === "razorpay" && <section className="rounded-3xl border bg-card p-6">
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Razorpay</h2><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{t("pay.test")}</span></div>
            <p className="mt-1 text-sm text-muted-foreground">{t("pay.razorpay.d")}</p>
            <Button onClick={startRazorpay} disabled={busy || seconds === 0} className="mt-5 w-full">{t("pay.razorpay")}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => action(() => cancelFn({ data: { order_id: order.id } }), t("pay.released"))} className="mt-3 w-full">{t("pay.cancel")}</Button>
          </section>}

          {isBuyer && order.status === "payment_pending" && order.payment_provider === "mock" && <section className="rounded-3xl border bg-card p-6">
            <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{t("pay.title")}</h2><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{t("pay.mock")}</span></div>
            <p className="mt-1 text-sm text-muted-foreground">{t("pay.mock.d")}</p>
            {!session ? <Button onClick={showPayment} disabled={busy || seconds === 0} className="mt-5 w-full"><QrCode className="h-4 w-4" />{t("pay.show")}</Button> : <div className="mt-5 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-card p-4 text-foreground"><QRCode value={session.qrPayload} size={180} fgColor="currentColor" bgColor="transparent" style={{ height: "auto", maxWidth: "100%", width: "100%" }} /><p className="mt-2 text-center text-xs text-muted-foreground">{t("pay.scan")}</p></div><div className="flex flex-col justify-center"><Button variant="outline" asChild><a href={session.intentUrl}><Smartphone className="h-4 w-4" />{t("pay.intent")}</a></Button><p className="mt-2 text-xs text-muted-foreground">{t("pay.intent.d")}</p></div></div>
              <div className="grid gap-2 sm:grid-cols-2"><Button disabled={busy} onClick={() => pay("success")}>{t("pay.simulateSuccess")}</Button><Button disabled={busy} variant="outline" onClick={() => pay("failure")}>{t("pay.simulateFailure")}</Button></div>
            </div>}
            <Button variant="ghost" disabled={busy} onClick={() => action(() => cancelFn({ data: { order_id: order.id } }), t("pay.released"))} className="mt-3 w-full">{t("pay.cancel")}</Button>
          </section>}

          {ticket && <section className="rounded-3xl border border-success bg-card p-6"><h2 className="flex items-center gap-2 text-xl font-bold text-success"><CheckCircle2 className="h-5 w-5" />{t("delivery.title")}</h2><p className="mt-2 text-sm text-muted-foreground">{t("delivery.d")}</p><Button asChild className="mt-4"><a href={ticket.url} target="_blank" rel="noreferrer"><Download className="h-4 w-4" />{t("delivery.open")}</a></Button><GatePassActions order={order} ticket={ticket} /><p className="mt-2 text-xs text-muted-foreground">{t("delivery.expiry")}</p></section>}

          {isBuyer && order.status === "ticket_delivered" && <div><Button disabled={busy} onClick={() => action(() => completeFn({ data: { order_id: order.id } }), t("order.completed"))}>{t("order.confirm")}</Button><p className="mt-2 text-xs text-muted-foreground">{t("order.entryHint")}</p></div>}
          {!isBuyer && order.payout_released_at && <p className="rounded-2xl bg-secondary p-4 text-sm font-semibold text-success">{t("order.payoutReleased")}</p>}

          <DisputePanel orderId={order.id} userId={data.viewerId} isBuyer={isBuyer} canRaise={Boolean(isBuyer && ["paid","ticket_delivered"].includes(order.status) && order.listings?.events?.starts_at && canRaiseDispute(order.listings.events.starts_at))} canRespond={order.seller_id===data.viewerId} />

          {isBuyer && ["ticket_delivered", "completed"].includes(order.status) && !data.review && <section className="rounded-3xl border bg-card p-6"><h2 className="text-xl font-bold">{t("review.title")}</h2><div className="mt-3 flex gap-1" aria-label={t("review.rating")}>{[1,2,3,4,5].map((n) => <Button key={n} type="button" variant="ghost" size="icon" aria-label={`${n}`} onClick={() => setRating(n)}><Star className={`h-6 w-6 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} /></Button>)}</div><Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("review.placeholder")} maxLength={1000} /><Button disabled={busy} className="mt-3" onClick={() => action(() => reviewFn({ data: { order_id: order.id, rating, comment: comment || undefined } }), t("review.saved"))}>{t("review.submit")}</Button></section>}
          {data.review && <p className="rounded-2xl bg-secondary p-4 text-sm">{t("review.yours")}: {data.review.rating}/5 {data.review.comment && `· ${data.review.comment}`}</p>}

          <section className="rounded-3xl border bg-card p-6"><h2 className="text-xl font-bold">{t("order.history")}</h2><ol className="mt-4 space-y-4">{history.map((event) => <li key={event.id} className="border-l-2 pl-4"><p className="font-semibold"><OrderStatusBadge status={event.to_status} /></p><p className="mt-1 text-sm text-muted-foreground">{event.note}</p><p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</p></li>)}</ol></section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border bg-card p-5"><h2 className="font-bold">{t("buy.breakdown")}</h2><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><dt>{t("buy.tickets")}</dt><dd>{formatINR(Number(order.price_paise) * order.quantity)}</dd></div><div className="flex justify-between"><dt>{t("buy.buyerFee")}</dt><dd>{formatINR(Number(order.buyer_fee_paise))}</dd></div><div className="flex justify-between"><dt>{t("buy.gstOnFee")}</dt><dd>{formatINR(Number(order.buyer_fee_gst_paise))}</dd></div><div className="flex justify-between border-t pt-2 text-lg font-bold"><dt>{isBuyer ? t("buy.total") : t("order.sellerNet")}</dt><dd>{formatINR(Number(isBuyer ? order.total_paise : order.seller_net_paise))}</dd></div></dl>{order.invoice_number && <Button asChild variant="outline" className="mt-4 w-full"><Link to="/orders/$orderId/invoice" params={{ orderId: order.id }}><FileText className="h-4 w-4" />{t("invoice.view")}</Link></Button>}</section>
          <section className="rounded-3xl border bg-card p-5 text-sm"><h2 className="font-bold">{t("checkout.contact")}</h2><p className="mt-2">{order.buyer_name}</p><p className="text-muted-foreground">{order.buyer_phone}</p>{order.buyer_upi_id && <p className="mt-2 text-muted-foreground">UPI: {order.buyer_upi_id}</p>}</section>
          <p className="flex items-start gap-2 rounded-2xl bg-secondary p-4 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" />{t("trust.protection.d")}</p>
        </aside>
      </div>
    </div>
  );
}
