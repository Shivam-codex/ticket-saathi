import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: typeof supabase; userId: string };
async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const getLaunchStatus = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("redeem_launch_invite");
    if (error) throw new Error("Could not check launch access");
    return { inviteAccepted: data === true };
  });

export const getAdminLaunch = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [settings, invites, states] = await Promise.all([
      context.supabase.from("launch_settings").select("*").eq("id", "default").single(),
      context.supabase.from("launch_invites").select("*").order("created_at", { ascending: false }).limit(100),
      context.supabase.from("launch_state_controls").select("*").order("state_code"),
    ]);
    return { settings: settings.data, invites: invites.data ?? [], states: states.data ?? [] };
  });

export const adminSetLaunchSettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ soft_launch_enabled: z.boolean(), invite_required: z.boolean() }).parse(value))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin.from("launch_settings").select("*").eq("id", "default").single();
    const { error } = await supabaseAdmin.from("launch_settings").update({ ...data, updated_by: context.userId, updated_at: new Date().toISOString() }).eq("id", "default");
    if (error) throw new Error("Could not update launch settings");
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "launch.settings", entity: "launch_settings", entity_id: "default", before, after: data });
    return { ok: true as const };
  });

export const adminCreateInvite = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ max_uses: z.number().int().min(1).max(100_000), note: z.string().trim().max(200).optional(), expires_at: z.string().datetime({ offset: true }).nullable().optional() }).parse(value))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const code = `PASSON-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("launch_invites").insert({ code, max_uses: data.max_uses, note: data.note || null, expires_at: data.expires_at ?? null, created_by: context.userId });
    if (error) throw new Error("Could not create invite");
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "launch_invite.create", entity: "launch_invite", entity_id: code, after: { max_uses: data.max_uses, note: data.note || null, expires_at: data.expires_at ?? null } });
    return { ok: true as const, code };
  });

export const adminSetInviteActive = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(value))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin.from("launch_invites").select("active").eq("id", data.id).single();
    const { error } = await supabaseAdmin.from("launch_invites").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error("Could not update invite");
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "launch_invite.update", entity: "launch_invite", entity_id: data.id, before, after: { active: data.active } });
    return { ok: true as const };
  });

export const adminSetStateListings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ state_code: z.string().regex(/^[A-Za-z]{2}$/), listings_enabled: z.boolean() }).parse(value))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const stateCode = data.state_code.toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("launch_state_controls").upsert({ state_code: stateCode, listings_enabled: data.listings_enabled, updated_by: context.userId, updated_at: new Date().toISOString() });
    if (error) throw new Error("Could not update state control");
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "launch_state.update", entity: "launch_state", entity_id: stateCode, after: { listings_enabled: data.listings_enabled } });
    return { ok: true as const };
  });
