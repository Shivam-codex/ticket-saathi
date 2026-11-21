import { formatINR } from "@/lib/event-filters";
import { useI18n } from "@/lib/i18n";

export type QuoteView = {
  quantity: number;
  unitPricePaise: number;
  subtotalPaise: number;
  buyerFeePaise: number;
  buyerFeeGstPaise: number;
  buyerTotalPaise: number;
};

export function PriceBreakdown({ quote, buyerFeeBps = 500, gstBps = 1800 }: { quote: QuoteView; buyerFeeBps?: number; gstBps?: number }) {
  const { t } = useI18n();
  return (
    <div className="rounded-3xl border bg-card p-5" aria-label={t("buy.breakdown")}>
      <h2 className="text-lg font-bold">{t("buy.breakdown")}</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4"><dt>{t("buy.tickets")} × {quote.quantity}</dt><dd>{formatINR(quote.subtotalPaise)}</dd></div>
        <div className="flex justify-between gap-4"><dt>{t("buy.buyerFee")} ({buyerFeeBps / 100}%)</dt><dd>{formatINR(quote.buyerFeePaise)}</dd></div>
        <div className="flex justify-between gap-4"><dt>{t("buy.gstOnFee")} ({gstBps / 100}%)</dt><dd>{formatINR(quote.buyerFeeGstPaise)}</dd></div>
        <div className="flex justify-between gap-4 border-t pt-3 text-lg font-extrabold"><dt>{t("buy.total")}</dt><dd>{formatINR(quote.buyerTotalPaise)}</dd></div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{t("buy.sellerFeeNote")}</p>
    </div>
  );
}
