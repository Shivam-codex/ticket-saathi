import { z } from "zod";

export const CATEGORIES = ["movie", "sports", "concert"] as const;
export const CITIES = ["Pune", "Mumbai", "Delhi", "Bengaluru"] as const;
export const WHEN = ["today", "weekend", "week", "month"] as const;
export const PAGE_SIZE = 12;

export const eventSearchSchema = z.object({
  q: z.string().max(200).optional(),
  city: z.string().max(60).optional(),
  category: z.enum(CATEGORIES).optional(),
  when: z.enum(WHEN).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  maxPrice: z.coerce.number().int().positive().max(1_000_000).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
  ai: z.enum(["0", "1"]).optional(),
});
export type EventSearch = z.infer<typeof eventSearchSchema>;

const IST_OFFSET_MIN = 330;
/** Returns the IST calendar date (YYYY-MM-DD) for an instant. */
export function istDate(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}
/** Start of an IST calendar day (YYYY-MM-DD) as a UTC instant. */
export function istDayStart(ymd: string): Date {
  return new Date(new Date(`${ymd}T00:00:00Z`).getTime() - IST_OFFSET_MIN * 60_000);
}
function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}

/** Resolve a date window in IST. `to` is inclusive. Weekend = Sat+Sun (the current one if today is Sat/Sun). */
export function resolveDateRange(f: Pick<EventSearch, "when" | "from" | "to">, now = new Date()): { from: Date; to: Date | null } {
  const today = istDate(now);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 Sun .. 6 Sat
  if (f.from || f.to) {
    const from = f.from ? istDayStart(f.from) : now;
    return { from: from < now ? now : from, to: f.to ? istDayStart(addDays(f.to, 1)) : null };
  }
  switch (f.when) {
    case "today": return { from: now, to: istDayStart(addDays(today, 1)) };
    case "weekend": {
      const sat = dow === 0 ? addDays(today, -1) : addDays(today, (6 - dow + 7) % 7);
      const start = istDayStart(sat);
      return { from: start < now ? now : start, to: istDayStart(addDays(sat, 2)) };
    }
    case "week": return { from: now, to: istDayStart(addDays(today, 7)) };
    case "month": return { from: now, to: istDayStart(addDays(today, 30)) };
    default: return { from: now, to: null };
  }
}

export function formatINR(paise: number | null | undefined): string {
  if (paise == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: paise % 100 ? 2 : 0 }).format(paise / 100);
}

/** Resized image URL for known CDNs (Unsplash). Other URLs pass through. */
export function imageUrl(url: string | null | undefined, w: number, h?: number): string | undefined {
  if (!url) return undefined;
  if (url.includes("images.unsplash.com")) {
    const base = url.split("?")[0];
    return `${base}?w=${w}${h ? `&h=${h}` : ""}&fit=crop&auto=format&q=70`;
  }
  return url;
}

/** AI output → validated filters. Unknown/invalid values are dropped. */
export const aiFiltersSchema = z.object({
  city: z.string().nullable(),
  category: z.string().nullable(),
  max_price_rupees: z.number().nullable(),
  date_from: z.string().nullable(),
  date_to: z.string().nullable(),
  keywords: z.string().nullable(),
});
export type AiFilters = z.infer<typeof aiFiltersSchema>;

export function normaliseAiFilters(a: AiFilters): Omit<EventSearch, "page" | "ai"> {
  const out: Omit<EventSearch, "page" | "ai"> = {};
  const city = CITIES.find((c) => c.toLowerCase() === a.city?.trim().toLowerCase() || (c === "Bengaluru" && a.city?.toLowerCase() === "bangalore") || (c === "Mumbai" && a.city?.toLowerCase() === "bombay"));
  if (city) out.city = city;
  const cat = CATEGORIES.find((c) => c === a.category?.toLowerCase());
  if (cat) out.category = cat;
  if (a.max_price_rupees && a.max_price_rupees > 0) out.maxPrice = Math.min(Math.round(a.max_price_rupees), 1_000_000);
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (a.date_from && ymd.test(a.date_from)) out.from = a.date_from;
  if (a.date_to && ymd.test(a.date_to)) out.to = a.date_to;
  const kw = a.keywords?.trim();
  if (kw) out.q = kw.slice(0, 80);
  return out;
}
