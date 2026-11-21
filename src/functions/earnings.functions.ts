import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SellerEarningsRow } from "@/lib/earnings.server";

export const getSellerEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: orders, error }, { data: isAdmin }] = await Promise.all([
      context.supabase.from("orders").select("id, status, created_at, quantity, price_paise, seller_fee_paise, seller_fee_gst_paise, seller_net_paise, tcs_paise, tds_paise, listings(events(title)), payouts(status, amount_paise, provider_ref)").eq("seller_id", context.userId).in("status", ["paid", "ticket_delivered", "completed", "disputed", "refunded"]).order("created_at", { ascending: false }).limit(100),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    if (error) throw new Error("Could not load seller earnings");
    const rows: SellerEarningsRow[] = (orders ?? []).map((order) => {
      const refunded = order.status === "refunded";
      const payout = Array.isArray(order.payouts) ? order.payouts[0] : order.payouts;
      const sellerNet = refunded ? 0 : Number(order.seller_net_paise - order.tcs_paise - order.tds_paise);
      return {
        orderId: order.id,
        eventTitle: order.listings?.events?.title ?? "Event",
        createdAt: order.created_at,
        status: order.status,
        ticketSubtotalPaise: Number(order.price_paise) * order.quantity,
        sellerFeePaise: refunded ? 0 : Number(order.seller_fee_paise),
        sellerFeeGstPaise: refunded ? 0 : Number(order.seller_fee_gst_paise),
        tcsPaise: refunded ? 0 : Number(order.tcs_paise),
        tdsPaise: refunded ? 0 : Number(order.tds_paise),
        sellerNetPaise: sellerNet,
        feeInvoiceTotalPaise: refunded ? 0 : Number(order.seller_fee_paise + order.seller_fee_gst_paise),
        feeInvoiceNumber: `SF-${new Date(order.created_at).getUTCFullYear()}-${order.id.replaceAll("-", "").slice(0, 10).toUpperCase()}`,
        payoutStatus: refunded ? "refunded" : (payout?.status ?? "not_due"),
        payoutAmountPaise: refunded ? 0 : Number(payout?.amount_paise ?? sellerNet),
        payoutRef: payout?.provider_ref ?? null,
      };
    });
    const { summariseSellerEarnings } = await import("@/lib/earnings.server");
    return { rows, summary: summariseSellerEarnings(rows), isAdmin: !!isAdmin };
  });

export const adminReconciliation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orders } = await supabaseAdmin.from("orders").select("id, status, total_paise, seller_net_paise, tcs_paise, tds_paise").in("status", ["paid", "ticket_delivered", "completed", "disputed", "refunded"]).order("created_at", { ascending: false }).limit(100);
    const ids = (orders ?? []).map((o) => o.id);
    const [{ data: entries }, { data: payouts }, { data: tax }] = await Promise.all([
      ids.length ? supabaseAdmin.from("ledger_entries").select("order_id, transaction_group, account, direction, amount_paise, entry_type").in("order_id", ids) : Promise.resolve({ data: [] }),
      ids.length ? supabaseAdmin.from("payouts").select("order_id, status, amount_paise").in("order_id", ids) : Promise.resolve({ data: [] }),
      supabaseAdmin.from("tax_config").select("enabled, tcs_bps, tds_bps").order("effective_from", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const { reconcileOrder } = await import("@/lib/reconciliation.server");
    const rows = (orders ?? []).map((order) => reconcileOrder(order, (entries ?? []).filter((e) => e.order_id === order.id), (payouts ?? []).find((p) => p.order_id === order.id) ?? null));
    return { rows, attention: rows.filter((r) => r.status === "attention").length, tax: tax ?? { enabled: false, tcs_bps: 0, tds_bps: 0 } };
  });

export const adminUpdateTaxConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enabled: z.boolean(), tcs_bps: z.number().int().min(0).max(10_000), tds_bps: z.number().int().min(0).max(10_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.from("tax_config").insert(data).select("id").single();
    if (result.error) throw new Error("Could not save tax configuration");
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "tax_config.create", entity: "tax_config", entity_id: result.data.id, after: data });
    return { ok: true as const };
  });
