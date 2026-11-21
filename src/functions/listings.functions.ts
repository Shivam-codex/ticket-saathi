import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RuleEvent, ResaleRule } from "@/lib/listing-rules.server";

type Ctx = { supabase: typeof supabase; userId: string };

const tiersSchema = z.array(z.object({ name: z.string(), price_paise: z.number() })).catch([]);

async function loadRuleContext(ctx: Ctx, eventId: string) {
  const [ev, rules, ready, seller] = await Promise.all([
    ctx.supabase.from("events").select("id, title, starts_at, is_resellable, resale_max_percent, face_value_tiers, venues(state_code)").eq("id", eventId).maybeSingle(),
    ctx.supabase.from("resale_rules").select("scope, state_code, event_id, resale_allowed, max_price_bps_of_face, priority"),
    ctx.supabase.rpc("is_seller_ready", { _user_id: ctx.userId }),
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "seller" }),
  ]);
  if (!ev.data) throw new Error("Event not found");
  const tiers = tiersSchema.parse(ev.data.face_value_tiers);
  const event: RuleEvent = {
    id: ev.data.id, starts_at: ev.data.starts_at, is_resellable: ev.data.is_resellable,
    resale_max_percent: ev.data.resale_max_percent, state_code: ev.data.venues?.state_code ?? null,
    max_tier_paise: tiers.length ? Math.max(...tiers.map((t) => t.price_paise)) : null,
  };
  return { event, title: ev.data.title, rules: (rules.data ?? []) as ResaleRule[], sellerVerified: !!ready.data && !!seller.data };
}

async function comparables(eventId: string, excludeId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  let q = supabaseAdmin.from("listings").select("id, price_paise, section").eq("event_id", eventId).in("status", ["active", "sold", "held"]).gte("created_at", since).limit(200);
  if (excludeId) q = q.neq("id", excludeId);
  return ((await q).data ?? []).map((r) => ({ price_paise: Number(r.price_paise), section: r.section }));
}

/* ---------- sell wizard ---------- */

export const listSellableEvents = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ q: z.string().max(80).optional() }).parse(d))
  .handler(async ({ data }) => {
    let q = supabase.from("event_cards").select("id, title, category, starts_at, venue_name, city, is_resellable, image_url").gt("starts_at", new Date().toISOString()).order("starts_at").limit(20);
    const kw = data.q?.trim().replace(/[%_,()]/g, " ");
    if (kw) q = q.or(`title.ilike.%${kw}%,venue_name.ilike.%${kw}%,city.ilike.%${kw}%`);
    return (await q).data ?? [];
  });

export const getSellEvent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ev } = await context.supabase.from("events").select("id, title, starts_at, is_resellable, face_value_tiers, venues(name, city, state_code)").eq("id", data.id).maybeSingle();
    if (!ev) return null;
    return { ...ev, face_value_tiers: tiersSchema.parse(ev.face_value_tiers) };
  });

const quoteSchema = z.object({
  event_id: z.string().uuid(),
  section: z.string().trim().max(80).optional(),
  quantity: z.number().int(),
  face_value_paise: z.number().int(),
  price_paise: z.number().int(),
  listing_id: z.string().uuid().optional(),
});

/** Live rules check + fair-price hint for the wizard and edit form. */
export const quoteListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => quoteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { evaluateListing, fairPriceHint } = await import("@/lib/listing-rules.server");
    const rc = await loadRuleContext(context, data.event_id);
    const verdict = evaluateListing({ now: new Date(), event: rc.event, rules: rc.rules, sellerVerified: rc.sellerVerified, facePaise: data.face_value_paise, pricePaise: data.price_paise, quantity: data.quantity });
    const hint = fairPriceHint(data.price_paise, await comparables(data.event_id, data.listing_id), data.section);
    return { ...verdict, hint };
  });

const createSchema = quoteSchema.omit({ listing_id: true }).extend({
  seat_info: z.string().trim().max(120).optional(),
  file_path: z.string().min(10).max(300),
  file_mime: z.enum(["application/pdf", "image/png", "image/jpeg", "image/webp"]),
  warranty: z.literal(true),
});

export const createListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!data.file_path.startsWith(`${context.userId}/`) || data.file_path.includes("..")) throw new Error("Invalid file");
    const { evaluateListing } = await import("@/lib/listing-rules.server");
    const rc = await loadRuleContext(context, data.event_id);
    const verdict = evaluateListing({ now: new Date(), event: rc.event, rules: rc.rules, sellerVerified: rc.sellerVerified, facePaise: data.face_value_paise, pricePaise: data.price_paise, quantity: data.quantity });
    if (!verdict.ok) return { ok: false as const, reasons: verdict.reasons };

    const { data: row, error } = await context.supabase.from("listings").insert({
      seller_id: context.userId, event_id: data.event_id, section: data.section || null, seat_info: data.seat_info || null,
      quantity: data.quantity, face_value_paise: data.face_value_paise, price_paise: data.price_paise, status: "draft",
    }).select("id").single();
    if (error) {
      const message = error.message.includes("NEW_SELLER_DAILY_LIMIT") ? "New sellers can create up to five listings per day." : error.message.includes("SELLER_BANNED") ? "This seller account is suspended." : "We couldn't create this listing. Check your seller status and try again.";
      return { ok: false as const, reasons: [{ code: error.message.includes("NEW_SELLER_DAILY_LIMIT") ? "DAILY_LIMIT" : "SELLER_NOT_VERIFIED", message }] };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("listing_secrets").insert({ listing_id: row.id, seller_id: context.userId, file_path: data.file_path, file_mime: data.file_mime });
    const { recordSellerDeviceSignal } = await import("@/lib/risk.server");
    await recordSellerDeviceSignal(context.userId, row.id).catch(() => undefined);
    return { ok: true as const, id: row.id };
  });

/** Run the verification pipeline for a listing (seller triggers right after upload; admin can re-run). */
export const verifyListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: own } = await context.supabase.from("listings").select("id, seller_id, event_id, section, seat_info, status, price_paise, face_value_paise, quantity").eq("id", data.id).maybeSingle();
    if (!own) throw new Error("Listing not found");
    const { runVerification } = await import("@/lib/verification/pipeline.server");
    return runVerification(own);
  });

/* ---------- seller dashboard ---------- */

export const myListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("listings")
      .select("id, event_id, section, seat_info, quantity, face_value_paise, price_paise, status, is_paused, verification_status, trust_score, block_reason, created_at, events(title, starts_at, venues(name, city))")
      .eq("seller_id", context.userId).order("created_at", { ascending: false }).limit(100);
    return data ?? [];
  });

export const updateListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.discriminatedUnion("action", [
    z.object({ id: z.string().uuid(), action: z.literal("price"), price_paise: z.number().int() }),
    z.object({ id: z.string().uuid(), action: z.enum(["pause", "resume", "cancel"]) }),
  ]).parse(d))
  .handler(async ({ data, context }) => {
    const { data: l } = await context.supabase.from("listings").select("id, seller_id, event_id, section, status, is_paused, verification_status, face_value_paise, price_paise, quantity").eq("id", data.id).eq("seller_id", context.userId).maybeSingle();
    if (!l) throw new Error("Listing not found");
    if (!["draft", "active"].includes(l.status)) return { ok: false as const, message: "This listing can no longer be changed." };
    if (data.action === "resume") {
      const { data: current } = await context.supabase.from("listings").select("auto_hidden").eq("id", data.id).single();
      if (current?.auto_hidden) return { ok: false as const, message: "This listing is hidden pending a trust review." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { evaluateListing } = await import("@/lib/listing-rules.server");
    const check = async (price: number) => {
      const rc = await loadRuleContext(context, l.event_id);
      return evaluateListing({ now: new Date(), event: rc.event, rules: rc.rules, sellerVerified: rc.sellerVerified, facePaise: Number(l.face_value_paise), pricePaise: price, quantity: l.quantity });
    };
    let patch: { price_paise?: number; status?: "draft" | "active" | "cancelled"; is_paused?: boolean } = {};
    if (data.action === "price") {
      const v = await check(data.price_paise);
      if (!v.ok) return { ok: false as const, message: v.reasons.map((r) => r.message).join(" ") };
      patch = { price_paise: data.price_paise };
    } else if (data.action === "pause") {
      patch = { status: "draft", is_paused: true };
    } else if (data.action === "resume") {
      if (l.verification_status !== "approved") return { ok: false as const, message: "This listing is still being verified." };
      const v = await check(Number(l.price_paise));
      if (!v.ok) return { ok: false as const, message: v.reasons.map((r) => r.message).join(" ") };
      patch = { status: "active", is_paused: false };
    } else {
      patch = { status: "cancelled", is_paused: false };
    }
    // guard against races with a sale: only update if still draft/active
    const { error } = await supabaseAdmin.from("listings").update(patch).eq("id", l.id).in("status", ["draft", "active"]);
    if (error) throw new Error("Could not update listing");
    if (data.action === "resume") await supabaseAdmin.rpc("notify_listing_available", { p_listing_id: l.id });
    return { ok: true as const };
  });

/* ---------- admin review ---------- */

async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const adminReviewQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: rows } = await context.supabase.from("listings")
      .select("id, section, seat_info, quantity, face_value_paise, price_paise, status, trust_score, block_reason, created_at, events(title, starts_at), listing_secrets(file_path, file_mime, qr_source, extracted, checks)")
      .eq("verification_status", "review").in("status", ["draft"]).order("trust_score", { ascending: true, nullsFirst: true }).order("created_at").limit(50);
    const out = [];
    for (const r of rows ?? []) {
      const sec = r.listing_secrets;
      const signed = sec ? await context.supabase.storage.from("ticket-proofs").createSignedUrl(sec.file_path, 300) : null;
      out.push({ ...r, file_url: signed?.data?.signedUrl ?? null });
    }
    return out;
  });

export const adminDecideListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), decision: z.enum(["approve", "reject"]), note: z.string().max(300).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: l } = await supabaseAdmin.from("listings").select("id, seller_id, event_id, status, verification_status, face_value_paise, price_paise, quantity").eq("id", data.id).maybeSingle();
    if (!l || l.status !== "draft") return { ok: false as const, message: "Listing is no longer pending." };
    let patch: { verification_status: string; status: "active" | "cancelled"; block_reason: string | null };
    if (data.decision === "approve") {
      const { evaluateListing } = await import("@/lib/listing-rules.server");
      const rc = await loadRuleContext({ supabase: supabaseAdmin as unknown as typeof supabase, userId: l.seller_id }, l.event_id);
      const v = evaluateListing({ now: new Date(), event: rc.event, rules: rc.rules, sellerVerified: rc.sellerVerified, facePaise: Number(l.face_value_paise), pricePaise: Number(l.price_paise), quantity: l.quantity });
      if (!v.ok) return { ok: false as const, message: v.reasons.map((r) => r.message).join(" ") };
      patch = { verification_status: "approved", status: "active", block_reason: null };
    } else {
      patch = { verification_status: "rejected", status: "cancelled", block_reason: data.note || "Rejected after manual review." };
    }
    await supabaseAdmin.from("listings").update(patch).eq("id", l.id);
    await supabaseAdmin.from("listing_secrets").update({ reviewed_by: context.userId, reviewed_at: new Date().toISOString() }).eq("listing_id", l.id);
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: `listing.${data.decision}`, entity: "listing", entity_id: l.id, before: { verification_status: l.verification_status, status: l.status }, after: patch as never });
    await supabaseAdmin.from("notifications").insert({ user_id: l.seller_id, kind: "listing_review", title: data.decision === "approve" ? "Your listing is live" : "Your listing was rejected", body: data.decision === "approve" ? null : (data.note ?? null), link: "/my-listings" });
    if (data.decision === "approve") await supabaseAdmin.rpc("notify_listing_available", { p_listing_id: l.id });
    return { ok: true as const };
  });
