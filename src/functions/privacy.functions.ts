import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const uid = context.userId;
    const [profile, roles, listings, orders, consents, notifications, disputes, payouts] = await Promise.all([
      sb.from("profiles").select("*").eq("id", uid).maybeSingle(),
      sb.from("user_roles").select("role, created_at").eq("user_id", uid),
      sb.from("listings").select("*").eq("seller_id", uid),
      sb.from("orders").select("*").or(`buyer_id.eq.${uid},seller_id.eq.${uid}`),
      sb.from("consents").select("*").eq("user_id", uid).order("created_at"),
      sb.from("notifications").select("*").eq("user_id", uid),
      sb.from("disputes").select("*").eq("raised_by", uid),
      sb.from("payouts").select("*").eq("seller_id", uid),
    ]);
    return {
      exported_at: new Date().toISOString(),
      account: { id: uid, email: context.claims.email ?? null, phone: (context.claims as { phone?: string }).phone ?? null },
      profile: profile.data, roles: roles.data, listings: listings.data, orders: orders.data,
      consents: consents.data, notifications: notifications.data, disputes: disputes.data, payouts: payouts.data,
    };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const { data: open } = await context.supabase
      .from("orders").select("id").or(`buyer_id.eq.${uid},seller_id.eq.${uid}`)
      .in("status", ["pending", "payment_pending", "paid", "delivered", "ticket_delivered", "disputed"]).limit(1);
    if (open && open.length > 0) {
      return { ok: false as const, reason: "You have orders in progress. You can delete your account once they are completed or refunded." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({ actor_id: uid, action: "account.delete", entity: "user", entity_id: uid });
    // Completed orders keep financial records (buyer/seller set to null) as required for tax law.
    await supabaseAdmin.from("listings").update({ status: "cancelled" }).eq("seller_id", uid).in("status", ["draft", "active"]);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) return { ok: false as const, reason: "We couldn't delete your account right now. Please try again or contact the Grievance Officer." };
    return { ok: true as const };
  });
