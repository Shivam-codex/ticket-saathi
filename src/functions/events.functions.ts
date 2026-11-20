import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { eventSearchSchema, normaliseAiFilters, PAGE_SIZE, resolveDateRange, CATEGORIES, type EventSearch } from "@/lib/event-filters";

const CARD_COLS = "id, title, category, starts_at, image_url, venue_name, city, active_listings, from_price_paise, is_resellable";

async function queryCards(f: Omit<EventSearch, "ai">, keywordFallback: boolean) {
  const page = f.page ?? 1;
  const { from, to } = resolveDateRange(f);
  let q = supabase.from("event_cards").select(CARD_COLS, { count: "exact" }).gte("starts_at", from.toISOString());
  if (to) q = q.lt("starts_at", to.toISOString());
  if (f.city) q = q.eq("city", f.city);
  if (f.category) q = q.eq("category", f.category);
  if (f.maxPrice) q = q.lte("from_price_paise", f.maxPrice * 100);
  const kw = f.q?.trim().replace(/[%_,()]/g, " ");
  if (kw) {
    const words = kw.split(/\s+/).filter((w) => w.length > 1).slice(0, 4);
    if (keywordFallback && words.length > 1) q = q.or(words.flatMap((w) => [`title.ilike.%${w}%`, `city.ilike.%${w}%`, `venue_name.ilike.%${w}%`]).join(","));
    else q = q.or(`title.ilike.%${kw}%,venue_name.ilike.%${kw}%,city.ilike.%${kw}%`);
  }
  const { data, count, error } = await q.order("starts_at").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new Error("Could not load events");
  return { items: data ?? [], total: count ?? 0, page };
}

export const searchEvents = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => eventSearchSchema.parse(d))
  .handler(async ({ data }) => {
    const hasStructured = !!(data.city || data.category || data.when || data.from || data.to || data.maxPrice);
    if (data.q && !hasStructured && data.ai !== "0") {
      const { parseQueryWithAI } = await import("@/lib/ai/parse-query.server");
      const ai = await parseQueryWithAI(data.q);
      if (ai) {
        const interpreted = normaliseAiFilters(ai);
        const res = await queryCards({ ...interpreted, ...(data.page ? { page: data.page } : {}) }, false);
        // AI was too strict? retry without keywords before giving up on AI filters.
        if (res.total === 0 && interpreted.q) {
          const { q: _drop, ...rest } = interpreted;
          const relaxed = await queryCards({ ...rest, ...(data.page ? { page: data.page } : {}) }, false);
          if (relaxed.total > 0) return { ...relaxed, interpreted: rest, source: "ai" as const };
        }
        return { ...res, interpreted, source: "ai" as const };
      }
      return { ...(await queryCards(data, true)), interpreted: null, source: "keyword" as const };
    }
    return { ...(await queryCards(data, !!data.q)), interpreted: null, source: "filters" as const };
  });

export const getHomeSections = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ city: z.string().max(60).optional() }).parse(d))
  .handler(async ({ data }) => {
    const nowIso = new Date().toISOString();
    const weekend = resolveDateRange({ when: "weekend" });
    const trendingQ = supabase.from("event_cards").select(CARD_COLS).gte("starts_at", nowIso).order("active_listings", { ascending: false }).order("starts_at").limit(8);
    let nearQ = supabase.from("event_cards").select(CARD_COLS).gte("starts_at", nowIso).order("starts_at").limit(8);
    if (data.city) nearQ = nearQ.eq("city", data.city);
    let weekendQ = supabase.from("event_cards").select(CARD_COLS).gte("starts_at", weekend.from.toISOString()).lt("starts_at", weekend.to!.toISOString()).order("starts_at").limit(8);
    if (data.city) weekendQ = weekendQ.eq("city", data.city);
    const [t, n, w] = await Promise.all([trendingQ, nearQ, weekendQ]);
    return { trending: t.data ?? [], near: n.data ?? [], weekend: w.data ?? [] };
  });

export const getEvent = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const [ev, listings] = await Promise.all([
      supabase.from("events").select("id, title, category, starts_at, image_url, organizer, description, is_resellable, face_value_tiers, resale_max_percent, venues(name, city, state_code, address)").eq("id", data.id).maybeSingle(),
      supabase.from("listings").select("id, section, seat_info, quantity, price_paise, face_value_paise, created_at").eq("event_id", data.id).eq("status", "active").order("price_paise").limit(100),
    ]);
    if (!ev.data) return null;
    const tiers = z.array(z.object({ name: z.string(), price_paise: z.number() })).catch([]).parse(ev.data.face_value_tiers);
    return { event: { ...ev.data, face_value_tiers: tiers }, listings: listings.data ?? [] };
  });

/* ---------- admin ---------- */

async function assertAdmin(ctx: { supabase: typeof supabase; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const adminListEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [ev, venues] = await Promise.all([
      context.supabase.from("events").select("id, title, category, starts_at, image_url, organizer, description, is_resellable, face_value_tiers, resale_max_percent, venue_id, venues(name, city)").order("starts_at", { ascending: false }).limit(200),
      context.supabase.from("venues").select("id, name, city, state_code").order("city").order("name"),
    ]);
    return { events: ev.data ?? [], venues: venues.data ?? [] };
  });

const tierSchema = z.object({ name: z.string().trim().min(1).max(60), price_paise: z.number().int().positive().max(100_000_000) });
export const eventInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(140),
  category: z.enum(CATEGORIES),
  venue_id: z.string().uuid().optional(),
  new_venue: z.object({ name: z.string().trim().min(2).max(120), city: z.string().trim().min(2).max(60), state_code: z.string().length(2) }).optional(),
  organizer: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  starts_at: z.string().datetime({ offset: true }),
  image_url: z.string().url().max(2000).optional(),
  face_value_tiers: z.array(tierSchema).min(1).max(12),
  is_resellable: z.boolean(),
  resale_max_percent: z.number().int().min(0).max(500).nullable(),
}).refine((v) => v.venue_id || v.new_venue, { message: "Choose or add a venue" });

export const adminUpsertEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => eventInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let venueId = data.venue_id;
    if (!venueId && data.new_venue) {
      const { data: v, error } = await context.supabase.from("venues").insert({ ...data.new_venue, state_code: data.new_venue.state_code.toUpperCase() }).select("id").single();
      if (error) throw new Error("Could not create venue");
      venueId = v.id;
    }
    const row = {
      title: data.title, category: data.category, venue_id: venueId!, organizer: data.organizer ?? null, description: data.description ?? null,
      starts_at: data.starts_at, image_url: data.image_url ?? null, face_value_tiers: data.face_value_tiers,
      is_resellable: data.is_resellable, resale_max_percent: data.resale_max_percent,
    };
    const before = data.id ? (await context.supabase.from("events").select("*").eq("id", data.id).maybeSingle()).data : null;
    const res = data.id
      ? await context.supabase.from("events").update(row).eq("id", data.id).select("id").single()
      : await context.supabase.from("events").insert(row).select("id").single();
    if (res.error) throw new Error("Could not save event");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: data.id ? "event.update" : "event.create", entity: "event", entity_id: res.data.id, before, after: row });
    return { id: res.data.id };
  });
