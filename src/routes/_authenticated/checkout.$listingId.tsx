import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createCheckout, getCheckoutBootstrap } from "@/functions/orders.functions";
import { PriceBreakdown } from "@/components/orders/PriceBreakdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/checkout/$listingId")({
  loader: async ({ params }) => {
    const data = await getCheckoutBootstrap({ data: { id: params.listingId } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `Checkout: ${loaderData.listing.events?.title ?? "ticket"} — PassOn` : "Checkout unavailable — PassOn";
    return { meta: [{ title }, { name: "description", content: "Reserve tickets and review the full buyer price before mock UPI payment." }, { property: "og:title", content: title }, { property: "og:description", content: "Secure PassOn checkout with transparent fees." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] };
  },
  notFoundComponent: () => <p className="mx-auto max-w-xl px-4 py-16 text-center">This listing is no longer available.</p>,
  component: CheckoutPage,
});

function CheckoutPage() {
  const data = Route.useLoaderData();
  const { t } = useI18n();
  const navigate = useNavigate();
  const checkout = useServerFn(createCheckout);
  const [name, setName] = useState(data.profile?.full_name ?? "");
  const [phone, setPhone] = useState("");
  const [upi, setUpi] = useState(data.profile?.saved_upi_id ?? "");
  const [key] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await checkout({ data: { listing_id: data.listing.id, idempotency_key: key, buyer_name: name, buyer_phone: phone, buyer_upi_id: upi || undefined } });
      if (!result.ok) {
        const messages = { invalid_phone: t("checkout.invalidPhone"), invalid_upi: t("checkout.invalidUpi"), unavailable: t("checkout.unavailable"), own_listing: t("checkout.ownListing"), provider_unavailable: t("checkout.providerUnavailable") } as const;
        toast.error(messages[result.reason]);
        return;
      }
      navigate({ to: "/orders/$orderId", params: { orderId: result.orderId } });
    } catch {
      toast.error(t("checkout.failed"));
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-extrabold">{t("checkout.title")}</h1>
      <p className="mt-1 text-muted-foreground">{data.listing.events?.title} · {data.listing.section ?? t("buy.general")} · {data.listing.quantity} {t("buy.tickets")}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <form onSubmit={submit} className="space-y-5 rounded-3xl border bg-card p-6">
          <div><h2 className="text-xl font-bold">{t("checkout.contact")}</h2><p className="text-sm text-muted-foreground">{t("checkout.contact.d")}</p></div>
          <div><Label htmlFor="buyer-name">{t("onb.name")}</Label><Input id="buyer-name" autoComplete="name" required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label htmlFor="buyer-phone">{t("auth.phone")}</Label><Input id="buyer-phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><Label htmlFor="buyer-upi">{t("checkout.savedUpi")}</Label><Input id="buyer-upi" autoComplete="off" placeholder="name@okaxis" value={upi} onChange={(e) => setUpi(e.target.value)} /><p className="mt-1 text-xs text-muted-foreground">{t("checkout.upiHelp")}</p></div>
          <div className="rounded-2xl bg-secondary p-4 text-sm"><p className="flex items-center gap-2 font-semibold"><LockKeyhole className="h-4 w-4" />{t(data.paymentProvider === "razorpay" ? "checkout.razorpayTitle" : "checkout.mockTitle")}</p><p className="mt-1 text-muted-foreground">{t(data.paymentProvider === "razorpay" ? "checkout.razorpay.d" : "checkout.mock.d")}</p>{!data.providerReady && <p className="mt-2 font-semibold text-destructive">{t("checkout.providerUnavailable")}</p>}</div>
          <Button type="submit" size="lg" disabled={busy || !data.providerReady} className="w-full rounded-2xl">{busy ? t("checkout.reserving") : t("checkout.reservePay")}</Button>
        </form>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <PriceBreakdown quote={data.quote} buyerFeeBps={data.feeConfig.buyer_fee_bps} gstBps={data.feeConfig.gst_bps} />
          <p className="flex items-start gap-2 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" />{t("buy.holdNote")} {t("trust.protection.d")}</p>
        </aside>
      </div>
    </div>
  );
}
