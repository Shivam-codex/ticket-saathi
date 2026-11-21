import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: typeof supabase; userId: string };
async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const adminOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context);
  const [users, listings, disputes, reports, grievances, orders, flags] = await Promise.all([
    context.supabase.from("profiles").select("id", { count: "exact", head: true }),
    context.supabase.from("listings").select("id", { count: "exact", head: true }),
    context.supabase.from("disputes").select("id", { count: "exact", head: true }).in("status", ["open","reviewing"]),
    context.supabase.from("listing_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
    context.supabase.from("grievance_tickets").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    context.supabase.from("orders").select("id,status,total_paise,buyer_fee_paise,buyer_fee_gst_paise,seller_fee_paise,seller_fee_gst_paise,created_at,listings(events(title))").in("status", ["paid","ticket_delivered","completed","disputed","refunded"]).order("created_at", { ascending: false }).limit(500),
    context.supabase.from("feature_flags").select("*"),
  ]);
  const rows = orders.data ?? [];
  const daily = new Map<string, { date: string; gmv: number; fees: number }>();
  for (const order of rows) {
    const date = order.created_at.slice(0, 10);
    const current = daily.get(date) ?? { date, gmv: 0, fees: 0 };
    current.gmv += Number(order.total_paise);
    current.fees += Number(order.buyer_fee_paise) + Number(order.buyer_fee_gst_paise) + Number(order.seller_fee_paise) + Number(order.seller_fee_gst_paise);
    daily.set(date, current);
  }
  return {
    counts: { users: users.count ?? 0, listings: listings.count ?? 0, disputes: disputes.count ?? 0, reports: reports.count ?? 0, grievances: grievances.count ?? 0 },
    totals: { gmvPaise: rows.reduce((n,o) => n + Number(o.total_paise),0), feesPaise: rows.reduce((n,o) => n + Number(o.buyer_fee_paise) + Number(o.buyer_fee_gst_paise) + Number(o.seller_fee_paise) + Number(o.seller_fee_gst_paise),0) },
    chart: [...daily.values()].sort((a,b) => a.date.localeCompare(b.date)).slice(-14), transactions: rows.slice(0,30), flags: flags.data ?? [],
  };
});

export const adminSetFeatureFlag = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.literal("ai_assistant"), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("feature_flags").upsert({ key: data.key, enabled: data.enabled, description: "Gemini multilingual PassOn help assistant" });
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "feature_flag.update", entity: "feature_flag", entity_id: data.key, after: { enabled: data.enabled } });
    return { ok: true as const };
  });

export const adminUsers = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context);
  const [profiles, roles] = await Promise.all([
    context.supabase.from("profiles").select("id,full_name,is_banned,is_verified,created_at").order("created_at", { ascending: false }).limit(200),
    context.supabase.from("user_roles").select("user_id,role"),
  ]);
  return (profiles.data ?? []).map(user => ({ ...user, user_roles: (roles.data ?? []).filter(row => row.user_id === user.id).map(row => ({ role: row.role })) }));
});

export const adminSetUserTrust = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), action: z.enum(["ban","unban","verify","unverify"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.user_id === context.userId && data.action === "ban") throw new Error("You cannot ban your own admin account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch = data.action === "ban" ? { is_banned: true } : data.action === "unban" ? { is_banned: false } : data.action === "verify" ? { is_verified: true } : { is_verified: false };
    const { data: before } = await supabaseAdmin.from("profiles").select("is_banned,is_verified").eq("id", data.user_id).single();
    await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
    if (data.action === "ban") await supabaseAdmin.from("listings").update({ status: "draft", is_paused: true }).eq("seller_id", data.user_id).eq("status", "active");
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: `user.${data.action}`, entity: "profile", entity_id: data.user_id, before, after: patch });
    return { ok: true as const };
  });

export const adminReportQueue = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context);
  const { data } = await context.supabase.from("listing_reports").select("*, listings(id,status,auto_hidden,report_count,trust_score,verification_status,price_paise,seller_id,events(title,starts_at))").eq("status", "pending").order("created_at").limit(100);
  return data ?? [];
});

export const adminDecideReport = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), decision: z.enum(["accepted","rejected"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: report } = await supabaseAdmin.from("listing_reports").select("*, listings(id,status,auto_hidden,verification_status)").eq("id", data.id).single();
    if (!report) throw new Error("Report not found");
    await supabaseAdmin.from("listing_reports").update({ status: data.decision, reviewed_by: context.userId, reviewed_at: new Date().toISOString() }).eq("id", data.id);
    if (data.decision === "accepted") {
      await supabaseAdmin.from("listings").update({ status: "draft", is_paused: true, auto_hidden: true }).eq("id", report.listing_id).in("status", ["active","draft"]);
    }
    if (data.decision === "rejected" && report.listings?.auto_hidden) {
      const { count } = await supabaseAdmin.from("listing_reports").select("id", { count: "exact", head: true }).eq("listing_id", report.listing_id).eq("status", "pending");
      if ((count ?? 0) < 3 && report.listings.verification_status === "approved") await supabaseAdmin.from("listings").update({ status: "active", auto_hidden: false, is_paused: false }).eq("id", report.listing_id).eq("status", "draft");
    }
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: `listing_report.${data.decision}`, entity: "listing_report", entity_id: data.id, before: report, after: { decision: data.decision } });
    return { ok: true as const };
  });

export const adminRuleConfig = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context);
  const [fees, rules] = await Promise.all([
    context.supabase.from("fee_config").select("*").order("effective_from", { ascending: false }).limit(10),
    context.supabase.from("resale_rules").select("*, events(title)").order("priority", { ascending: false }).limit(100),
  ]);
  return { fees: fees.data ?? [], rules: rules.data ?? [] };
});

export const adminSaveFeeConfig = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ buyer_fee_bps: z.number().int().min(0).max(3000), seller_fee_bps: z.number().int().min(0).max(3000), gst_bps: z.number().int().min(0).max(2800) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("fee_config").insert(data);
    if (error) throw new Error("Could not save fee configuration");
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "fee_config.create", entity: "fee_config", after: data });
    return { ok: true as const };
  });

export const adminSaveResaleRule = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ scope: z.enum(["global","state","event"]), state_code: z.string().length(2).nullable(), event_id: z.string().uuid().nullable(), resale_allowed: z.boolean(), max_price_bps_of_face: z.number().int().min(1).max(50000), priority: z.number().int().min(0).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.scope === "state" && !data.state_code) throw new Error("Choose a state");
    if (data.scope === "event" && !data.event_id) throw new Error("Choose an event");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("resale_rules").insert(data);
    if (error) throw new Error("Could not save resale rule");
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "resale_rule.create", entity: "resale_rule", after: data });
    return { ok: true as const };
  });
