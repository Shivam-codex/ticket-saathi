import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: typeof supabase; userId: string };
const id = z.string().uuid();
async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const getOrderDispute = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: id }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: dispute, error } = await context.supabase.from("disputes").select("*").eq("order_id", data.order_id).maybeSingle();
    if (error) throw new Error("Could not load dispute");
    if (!dispute) return null;
    const evidence: { path: string; url: string }[] = [];
    for (const path of dispute.evidence_paths ?? []) {
      const signed = await context.supabase.storage.from("dispute-evidence").createSignedUrl(path, 300);
      if (signed.data?.signedUrl) evidence.push({ path, url: signed.data.signedUrl });
    }
    return { ...dispute, evidence };
  });

export const uploadDisputeEvidence = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dispute_id: id, file_path: z.string().max(400), file_mime: z.enum(["application/pdf","image/png","image/jpeg","image/webp"]) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.file_path.startsWith(`${data.dispute_id}/${context.userId}/`) || data.file_path.includes("..")) throw new Error("Invalid evidence path");
    const { data: dispute } = await context.supabase.from("disputes").select("id, order_id, evidence_paths, evidence_deadline_at, orders!inner(buyer_id)").eq("id", data.dispute_id).maybeSingle();
    if (!dispute || dispute.orders?.buyer_id !== context.userId) throw new Error("Dispute not found");
    if (!dispute.evidence_deadline_at || new Date(dispute.evidence_deadline_at).getTime() < Date.now()) throw new Error("The evidence window has closed");
    if ((dispute.evidence_paths ?? []).length >= 5) throw new Error("You can upload up to five evidence files");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("disputes").update({ evidence_paths: [...(dispute.evidence_paths ?? []), data.file_path] }).eq("id", dispute.id);
    if (error) throw new Error("Could not attach evidence");
    return { ok: true as const };
  });

export const respondToDispute = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dispute_id: id, response: z.string().trim().min(5).max(3000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: dispute } = await context.supabase.from("disputes").select("id,response_due_at,status,orders!inner(seller_id)").eq("id", data.dispute_id).maybeSingle();
    if (!dispute || dispute.orders?.seller_id !== context.userId || !["open","reviewing"].includes(dispute.status)) throw new Error("Dispute not found");
    if (dispute.response_due_at && new Date(dispute.response_due_at).getTime() < Date.now()) throw new Error("The seller response window has closed");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("disputes").update({ seller_response: data.response, seller_responded_at: new Date().toISOString(), status: "reviewing" }).eq("id", dispute.id);
    if (error) throw new Error("Could not save your response");
    return { ok: true as const };
  });

export const adminDisputeQueue = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("disputes").select("*, orders(id,status,buyer_name,buyer_id,seller_id,listings(section,seat_info,events(title,starts_at)))").order("created_at").limit(100);
    if (error) throw new Error("Could not load disputes");
    return data ?? [];
  });

export const adminDecideDispute = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ dispute_id: id, decision: z.enum(["refund","payout","reject"]), note: z.string().trim().min(3).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dispute } = await supabaseAdmin.from("disputes").select("*").eq("id", data.dispute_id).maybeSingle();
    if (!dispute || !["open","reviewing"].includes(dispute.status)) throw new Error("This dispute is already decided");
    const { data: order } = await supabaseAdmin.from("orders").select("id,status,buyer_id,seller_id").eq("id", dispute.order_id).single();
    if (!order) throw new Error("The disputed order no longer exists");
    let payoutReleased = false;
    if (data.decision === "refund") {
      const { refundOrder } = await import("@/lib/payments/process.server");
      await refundOrder(order.id, context.userId, data.note);
    } else if (data.decision === "payout") {
      await supabaseAdmin.from("disputes").update({ status: "resolved_payout" }).eq("id", dispute.id);
      await supabaseAdmin.from("orders").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", order.id).eq("status", "disputed");
      await supabaseAdmin.from("order_events").insert({ order_id: order.id, actor_id: context.userId, from_status: "disputed", to_status: "completed", note: `Admin awarded seller payout: ${data.note}` });
      const { releasePayoutForOrder } = await import("@/lib/payments/process.server");
      payoutReleased = await releasePayoutForOrder(order.id);
    } else {
      const restored = dispute.prior_order_status === "paid" ? "paid" : "ticket_delivered";
      await supabaseAdmin.from("orders").update({ status: restored, updated_at: new Date().toISOString() }).eq("id", order.id).eq("status", "disputed");
      await supabaseAdmin.from("order_events").insert({ order_id: order.id, actor_id: context.userId, from_status: "disputed", to_status: restored, note: `Dispute rejected: ${data.note}` });
    }
    const nextStatus = data.decision === "refund" ? "resolved_refund" : data.decision === "payout" ? "resolved_payout" : "resolved_rejected";
    const { error } = await supabaseAdmin.from("disputes").update({ status: nextStatus, resolution_note: data.note, decided_by: context.userId, decided_at: new Date().toISOString() }).eq("id", dispute.id);
    if (error) throw new Error("Could not save the dispute decision");
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: `dispute.${data.decision}`, entity: "dispute", entity_id: dispute.id, before: { status: dispute.status, order_status: order.status }, after: { status: nextStatus, note: data.note, payoutReleased } });
    return { ok: true as const, payoutReleased };
  });

export const reportListing = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ listing_id: id, reason: z.enum(["fake_ticket","wrong_event","prohibited_resale","price_or_fraud","other"]), details: z.string().trim().max(2000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("listing_reports").insert({ listing_id: data.listing_id, reporter_id: context.userId, reason: data.reason, details: data.details || null });
    if (error) throw new Error(error.code === "23505" ? "You already reported this listing" : "Could not report this listing");
    return { ok: true as const };
  });

export const setEventFollow = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ event_id: id, max_price_paise: z.number().int().positive().max(100_000_000).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("event_follows").upsert({ user_id: context.userId, event_id: data.event_id, max_price_paise: data.max_price_paise }, { onConflict: "user_id,event_id" });
    if (error) throw new Error("Could not save this alert");
    return { ok: true as const };
  });

export const joinWaitlist = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ event_id: id, max_price_paise: z.number().int().positive().max(100_000_000), quantity: z.number().int().min(1).max(6) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("waitlist_entries").upsert({ user_id: context.userId, event_id: data.event_id, max_price_paise: data.max_price_paise, quantity: data.quantity, status: "waiting" }, { onConflict: "user_id,event_id" });
    if (error) throw new Error("Could not join the waitlist");
    return { ok: true as const };
  });

export const myAlerts = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const [follows, waitlist] = await Promise.all([
    context.supabase.from("event_follows").select("id,max_price_paise,events(id,title,starts_at)").eq("user_id", context.userId),
    context.supabase.from("waitlist_entries").select("id,max_price_paise,quantity,status,events(id,title,starts_at)").eq("user_id", context.userId),
  ]);
  return { follows: follows.data ?? [], waitlist: waitlist.data ?? [] };
});

export const assistantPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("feature_flags").select("enabled").eq("key", "ai_assistant").maybeSingle();
  return { enabled: data?.enabled ?? false };
});

export const myNotifications = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("notifications").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error("Could not load notifications");
  return data ?? [];
});

export const markNotificationRead = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", data.id).eq("user_id", context.userId);
    return { ok: true as const };
  });

export const createGrievance = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ subject: z.string().trim().min(3).max(160), details: z.string().trim().min(10).max(4000), order_id: id.optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("grievance_tickets").insert({ user_id: context.userId, subject: data.subject, details: data.details, order_id: data.order_id ?? null });
    if (error) throw new Error("Could not create your grievance ticket");
    return { ok: true as const };
  });

export const myGrievances = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data } = await context.supabase.from("grievance_tickets").select("*").eq("user_id", context.userId).order("created_at", { ascending: false });
  return data ?? [];
});

export const adminGrievanceQueue = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context);
  const { data } = await context.supabase.from("grievance_tickets").select("*").order("due_at").limit(100);
  return data ?? [];
});

export const adminResolveGrievance = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id, status: z.enum(["in_review","resolved"]), note: z.string().trim().max(3000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin.from("grievance_tickets").select("status").eq("id", data.id).single();
    await supabaseAdmin.from("grievance_tickets").update({ status: data.status, resolution_note: data.note || null }).eq("id", data.id);
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: `grievance.${data.status}`, entity: "grievance", entity_id: data.id, before, after: { status: data.status, note: data.note } });
    return { ok: true as const };
  });
