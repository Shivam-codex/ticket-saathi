import { describe, expect, it } from "vitest";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calculateOrderQuote } from "@/lib/pricing.server";
import { releasePayoutForOrder, refundOrder } from "@/lib/payments/process.server";
import { reconcileOrder } from "@/lib/reconciliation.server";

const hasDatabase = !!(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]);

describe.skipIf(!hasDatabase)("Phase 5 payment lifecycle database integration", () => {
  it("posts one payment across duplicate webhooks, refunds undelivered orders and releases payout after entry", async () => {
    const marker = crypto.randomUUID();
    const userIds: string[] = [];
    let venueId: string | null = null;
    let eventId: string | null = null;
    const listingIds: string[] = [];
    try {
      for (let i = 0; i < 2; i += 1) {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({ email: `passon-payments-${marker}-${i}@example.com`, password: crypto.randomUUID(), email_confirm: true });
        if (error || !data.user) throw error ?? new Error("Could not create test user");
        userIds.push(data.user.id);
      }
      const [sellerId, buyerId] = userIds as [string, string];
      const venue = await supabaseAdmin.from("venues").insert({ name: `Payment test ${marker}`, city: "Pune", state_code: "MH" }).select("id").single();
      if (venue.error) throw venue.error;
      venueId = venue.data.id;
      const event = await supabaseAdmin.from("events").insert({
        title: `Payment lifecycle ${marker}`, category: "concert", venue_id: venueId,
        starts_at: new Date(Date.now() + 86_400_000).toISOString(), ends_at: new Date(Date.now() + 90_000_000).toISOString(), soft_launch_allowed: true,
        face_value_tiers: [{ name: "General", price_paise: 100_000 }],
      }).select("id").single();
      if (event.error) throw event.error;
      eventId = event.data.id;
      const fees = await supabaseAdmin.from("fee_config").select("id, buyer_fee_bps, seller_fee_bps, gst_bps").order("effective_from", { ascending: false }).limit(1).single();
      if (fees.error) throw fees.error;
      const quote = calculateOrderQuote(100_000, 1, { buyerFeeBps: fees.data!.buyer_fee_bps, sellerFeeBps: fees.data!.seller_fee_bps, gstBps: fees.data!.gst_bps });

      async function createOrder(withTicket: boolean) {
        const listing = await supabaseAdmin.from("listings").insert({ seller_id: sellerId, event_id: eventId!, quantity: 1, face_value_paise: 100_000, price_paise: 100_000, status: "active", verification_status: "approved", trust_score: 100 }).select("id").single();
        if (listing.error) throw listing.error;
        listingIds.push(listing.data.id);
        if (withTicket) {
          const secret = await supabaseAdmin.from("listing_secrets").insert({ listing_id: listing.data.id, seller_id: sellerId, file_path: `${sellerId}/${marker}-${listing.data.id}.png`, file_mime: "image/png" });
          if (secret.error) throw secret.error;
        }
        const created = await supabaseAdmin.rpc("create_checkout_order_v2", {
          p_listing_id: listing.data.id, p_buyer_id: buyerId, p_quantity: 1, p_idempotency_key: crypto.randomUUID(),
          p_unit_price_paise: quote.unitPricePaise, p_buyer_fee_paise: quote.buyerFeePaise, p_buyer_fee_gst_paise: quote.buyerFeeGstPaise,
          p_seller_fee_paise: quote.sellerFeePaise, p_seller_fee_gst_paise: quote.sellerFeeGstPaise, p_total_paise: quote.buyerTotalPaise,
          p_seller_net_paise: quote.sellerNetPaise, p_tcs_paise: 0, p_tds_paise: 0, p_fee_config_id: fees.data!.id,
          p_buyer_name: "Payment Test", p_buyer_phone: "+919876543210", p_buyer_state_code: "MH", p_buyer_upi_id: "buyer@okaxis", p_payment_method: "upi", p_payment_provider: "mock",
        });
        if (created.error || !created.data?.id) throw created.error ?? new Error("Order creation failed");
        return created.data.id;
      }

      const deliveredOrderId = await createOrder(true);
      const refundOrderId = await createOrder(false);
      const firstPayment = await supabaseAdmin.rpc("record_order_payment", { p_order_id: deliveredOrderId, p_payment_ref: `mock_pay_${marker}`, p_actor_id: buyerId, p_delivery_hours: 24 });
      expect(firstPayment.error).toBeNull();
      expect(firstPayment.data!.status).toBe("ticket_delivered");
      const firstWebhook = await supabaseAdmin.rpc("begin_webhook", { p_provider: "mock", p_event_id: `evt_${marker}`, p_order_id: deliveredOrderId, p_payload_hash: marker });
      const duplicateWebhook = await supabaseAdmin.rpc("begin_webhook", { p_provider: "mock", p_event_id: `evt_${marker}`, p_order_id: deliveredOrderId, p_payload_hash: marker });
      expect(firstWebhook.data).toBe(true);
      expect(duplicateWebhook.data).toBe(false);
      await supabaseAdmin.rpc("record_order_payment", { p_order_id: deliveredOrderId, p_payment_ref: `mock_pay_${marker}`, p_actor_id: buyerId, p_delivery_hours: 24 });
      const paymentEntries = await supabaseAdmin.from("ledger_entries").select("id").eq("order_id", deliveredOrderId).eq("entry_type", "payment_provider");
      expect(paymentEntries.data).toHaveLength(1);

      const undeliveredPayment = await supabaseAdmin.rpc("record_order_payment", { p_order_id: refundOrderId, p_payment_ref: `mock_pay_refund_${marker}`, p_actor_id: buyerId, p_delivery_hours: 24 });
      expect(undeliveredPayment.data!.status).toBe("paid");
      await supabaseAdmin.from("orders").update({ delivery_due_at: new Date(Date.now() - 1000).toISOString() }).eq("id", refundOrderId);
      const refunded = await refundOrder(refundOrderId, buyerId, "Automatic refund: ticket not delivered within 24 hours");
      expect(refunded.status).toBe("refunded");
      const duplicateRefund = await refundOrder(refundOrderId, buyerId, "Retry must not refund twice");
      expect(duplicateRefund.status).toBe("refunded");
      const refundEntries = await supabaseAdmin.from("ledger_entries").select("order_id, transaction_group, account, direction, amount_paise, entry_type").eq("order_id", refundOrderId);
      expect(reconcileOrder(refunded, refundEntries.data ?? [], null).status).toBe("balanced");
      expect((refundEntries.data ?? []).filter((e) => e.entry_type === "refund_provider")).toHaveLength(1);

      await supabaseAdmin.from("events").update({ starts_at: new Date(Date.now() - 60_000).toISOString(), ends_at: new Date(Date.now() + 3_600_000).toISOString() }).eq("id", eventId);
      const entry = await supabaseAdmin.rpc("confirm_buyer_entry", { p_order_id: deliveredOrderId, p_buyer_id: buyerId });
      expect(entry.error).toBeNull();
      expect(entry.data!.entry_confirmed_at).not.toBeNull();
      expect(await releasePayoutForOrder(deliveredOrderId)).toBe(true);
      const payout = await supabaseAdmin.from("payouts").select("status, amount_paise").eq("order_id", deliveredOrderId).single();
      expect(payout.data).toMatchObject({ status: "paid", amount_paise: 94_100 });
      const payoutEntries = await supabaseAdmin.from("ledger_entries").select("id").eq("order_id", deliveredOrderId).eq("entry_type", "payout_provider");
      expect(payoutEntries.data).toHaveLength(1);
    } finally {
      if (listingIds.length) {
        const { data: orders } = await supabaseAdmin.from("orders").select("id").in("listing_id", listingIds);
        const orderIds = (orders ?? []).map((o) => o.id);
        if (orderIds.length) {
          await supabaseAdmin.from("payment_operations").delete().in("order_id", orderIds);
          await supabaseAdmin.from("payment_webhook_events").delete().in("order_id", orderIds);
          await supabaseAdmin.from("ledger_entries").delete().in("order_id", orderIds);
          await supabaseAdmin.from("payouts").delete().in("order_id", orderIds);
          await supabaseAdmin.from("order_events").delete().in("order_id", orderIds);
          await supabaseAdmin.from("orders").delete().in("id", orderIds);
        }
        await supabaseAdmin.from("listing_secrets").delete().in("listing_id", listingIds);
        await supabaseAdmin.from("listings").delete().in("id", listingIds);
      }
      if (eventId) await supabaseAdmin.from("events").delete().eq("id", eventId);
      if (venueId) await supabaseAdmin.from("venues").delete().eq("id", venueId);
      for (const id of userIds) await supabaseAdmin.auth.admin.deleteUser(id);
    }
  }, 60_000);
});
