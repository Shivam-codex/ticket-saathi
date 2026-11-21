import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, MapPin, ShieldCheck, Star, TicketCheck } from "lucide-react";
import { getListingDetail } from "@/functions/orders.functions";
import { formatINR, imageUrl } from "@/lib/event-filters";
import { PriceBreakdown } from "@/components/orders/PriceBreakdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

const listingQuery = (id: string) => queryOptions({ queryKey: ["listing", id], queryFn: () => getListingDetail({ data: { id } }) });

export const Route = createFileRoute("/listings/$listingId")({
  loader: async ({ context, params }) => {
    if (!/^[0-9a-f-]{36}$/i.test(params.listingId)) throw notFound();
    const data = await context.queryClient.ensureQueryData(listingQuery(params.listingId));
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Listing unavailable — PassOn" }, { name: "robots", content: "noindex" }] };
    const title = `${loaderData.listing.events?.title ?? "Event"} ${loaderData.listing.section ?? "tickets"} | PassOn`;
    const description = `Buy ${loaderData.listing.quantity} verified resale ticket${loaderData.listing.quantity > 1 ? "s" : ""}. Full buyer fee and GST shown upfront, with Buyer Protection.`;
    const image = loaderData.listing.events?.image_url ? imageUrl(loaderData.listing.events.image_url, 1200, 630) : null;
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" },
      { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
      ...(image ? [{ property: "og:image", content: image }, { name: "twitter:image", content: image }] : []),
    ] };
  },
  notFoundComponent: () => <div className="mx-auto max-w-xl px-4 py-16 text-center"><h1 className="text-2xl font-bold">Listing unavailable</h1><Button asChild className="mt-5"><Link to="/events">Browse events</Link></Button></div>,
  component: ListingPage,
});

function ListingPage() {
  const data = Route.useLoaderData();
  const { t } = useI18n();
  const { listing: l, quote, sellerStats, feeConfig } = data;
  const e = l.events;
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      <Link to="/events/$eventId" params={{ eventId: l.event_id }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{t("buy.backEvent")}</Link>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-3xl border bg-card">
            {e?.image_url && <img src={imageUrl(e.image_url, 1000, 360)} alt={e.title} width={1000} height={360} className="h-44 w-full object-cover" />}
            <div className="p-6">
              <Badge variant="secondary">{e?.category}</Badge>
              <h1 className="mt-3 text-3xl font-extrabold">{e?.title}</h1>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{e?.starts_at && new Date(e.starts_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" })} IST</p>
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{e?.venues?.name}, {e?.venues?.city}</p>
              </div>
              <div className="mt-6 rounded-2xl bg-secondary p-4">
                <p className="text-xl font-bold">{l.section ?? t("buy.general")}{l.seat_info ? ` · ${l.seat_info}` : ""}</p>
                <p className="mt-1 text-sm text-muted-foreground">{l.quantity} {t("buy.together")} · {t("buy.faceValue")} {formatINR(Number(l.face_value_paise))}</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border bg-card p-6">
            <h2 className="text-xl font-bold">{t("buy.sellerTrust")}</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-2 text-sm font-semibold"><Star className="h-4 w-4 text-primary" />{sellerStats.averageRating == null ? t("buy.newSeller") : `${sellerStats.averageRating}/5 · ${sellerStats.ratingCount} ${t("buy.ratings")}`}</span>
              <span className="text-sm text-muted-foreground">{sellerStats.completedSales} {t("buy.completedSales")}</span>
            </div>
            {l.verification_status === "approved" && <p className="mt-4 flex items-start gap-2 text-sm text-success"><TicketCheck className="mt-0.5 h-5 w-5 shrink-0" /><span><b>{t("buy.verified")}</b>{l.trust_score != null ? ` · ${l.trust_score}/100` : ""}<br /><span className="text-muted-foreground">{t("buy.verified.d")}</span></span></p>}
            <p className="mt-4 flex items-start gap-2 text-sm"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" /><span><b>{t("trust.protection")}</b><br /><span className="text-muted-foreground">{t("trust.protection.d")} {t("buy.protection.d")}</span></span></p>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <PriceBreakdown quote={quote} buyerFeeBps={feeConfig.buyer_fee_bps} gstBps={feeConfig.gst_bps} />
          <Button asChild size="lg" className="w-full rounded-2xl text-base"><Link to="/checkout/$listingId" params={{ listingId: l.id }}>{t("buy.reserve")} · {formatINR(quote.buyerTotalPaise)}</Link></Button>
          <p className="text-center text-xs text-muted-foreground">{t("buy.holdNote")}</p>
        </aside>
      </div>
    </div>
  );
}
