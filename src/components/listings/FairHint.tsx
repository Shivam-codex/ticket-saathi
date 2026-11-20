import { useMemo } from "react";
import { CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatINR } from "@/lib/event-filters";

type Hint = { level: "unknown"; samples: number } | { level: "fair" | "high" | "low"; samples: number; medianPaise: number; diffPct: number };

export function FairHint({ quote }: { quote: { hint: Hint } }) {
  const { t } = useI18n();
  const h = quote.hint;
  const body = useMemo(() => {
    if (h.level === "unknown") return { cls: "bg-secondary", icon: null, text: t("fair.unknown") };
    const m = formatINR(h.medianPaise);
    if (h.level === "high") return { cls: "border border-warning/50 bg-warning/10", icon: <TrendingUp className="h-4 w-4" />, text: `${t("fair.high")} (${h.diffPct}% · ${t("fair.median")} ${m})` };
    if (h.level === "low") return { cls: "border border-warning/50 bg-warning/10", icon: <TrendingDown className="h-4 w-4" />, text: `${t("fair.low")} (${h.diffPct}% · ${t("fair.median")} ${m})` };
    return { cls: "bg-success/10", icon: <CheckCircle2 className="h-4 w-4 text-success" />, text: `${t("fair.fair")} (${t("fair.median")} ${m}, ${h.samples})` };
  }, [h, t]);
  return <p aria-live="polite" className={`flex items-center gap-2 rounded-2xl p-3 text-sm ${body.cls}`}>{body.icon}{body.text}</p>;
}
