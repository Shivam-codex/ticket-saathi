import { describe, expect, it } from "vitest";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calculateOrderQuote } from "@/lib/pricing.server";

const hasDatabase = !!(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]);

describe.skipIf(!hasDatabase)("atomic checkout database integration", () => {
  it("allows exactly one winner under concurrent attempts and returns the same order on retry", async () => {
    const marker = crypto.randomUUID();
    const userIds: string[] = [];
    let venueId: string | null = null;
    let eventId: string | null = null;
    let listingId: string | null = null;
    try {
      for (let i = 0; i < 3; i += 1) {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: `passon-checkout-${marker}-${i}@example.com`,
          password: crypto.randomUUID(),
          email_confirm: true,
        });
        if (error || !data.user) throw error ?? new Error("Could not create test user");
        userIds.push(data.user.id);
      }
      const [sellerId, ...buyerIds] = userIds as [string, string, string];
      const venue = await supabaseAdmin.from("venues").insert({ name: `Concurrency test ${marker}`, city: "Pune", state_code: "MH" }).select("id").single();
      if (venue.error) throw venue.error;
      venueId = venue.data.id;
      const event = await supabaseAdmin.from("events").insert({
        title: `Concurrency test ${marker}`,
        category: "concert",
        venue_id: venueId,
        starts_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        face_value_tiers: [{ name: "General", price_paise: 100_000 }],
      }).select("id").single();
      if (event.error) throw event.error;
      eventId = event.data.id;
      const listing = await supabaseAdmin.from("listings").insert({
        seller_id: sellerId,
        event_id: eventId,
        quantity: 1,
        face_value_paise: 100_000,
        price_paise: 100_000,
        status: "active",
        verification_status: "approved",
        trust_score: 100,
      }).select("id").single();
      if (listing.error) throw listing.error;
      listingId = listing.data.id;
      const fees = await supabaseAdmin.from("fee_config").select("id, buyer_fee_bps, seller_fee_bps, gst_bps").order("effective_from", { ascending: false }).limit(1).single();
      if (fees.error) throw fees.error;
      const quote = calculateOrderQuote(100_000, 1, { buyerFeeBps: fees.data.buyer_fee_bps, sellerFeeBps: fees.data.seller_fee_bps, gstBps: fees.data.gst_bps });
      const keys = Array.from({ length: 12 }, () => crypto.randomUUID());
      const attempts = await Promise.all(keys.map((key, index) => supabaseAdmin.rpc("create_checkout_order", {
        p_listing_id: listingId!,
        p_buyer_id: buyerIds[index % buyerIds.length]!,
        p_quantity: 1,
        p_idempotency_key: key,
        p_unit_price_paise: quote.unitPricePaise,
        p_buyer_fee_paise: quote.buyerFeePaise,
        p_buyer_fee_gst_paise: quote.buyerFeeGstPaise,
        p_seller_fee_paise: quote.sellerFeePaise,
        p_seller_fee_gst_paise: quote.sellerFeeGstPaise,
        p_total_paise: quote.buyerTotalPaise,
        p_seller_net_paise: quote.sellerNetPaise,
        p_fee_config_id: fees.data.id,
        p_buyer_name: "Concurrency Test",
        p_buyer_phone: "+919876543210",
        p_buyer_state_code: "MH",
        p_buyer_upi_id: "test@okaxis",
        p_payment_method: "upi",
      })));
      const winners = attempts.filter((attempt) => attempt.data?.id != null);
      expect(winners).toHaveLength(1);
      expect(attempts.every((attempt) => attempt.error == null)).toBe(true);
      const winner = winners[0]?.data;
      if (!winner) throw new Error("Expected one winning checkout");
      const winnerIndex = attempts.findIndex((attempt) => attempt.data?.id === winner.id);
      const retry = await supabaseAdmin.rpc("create_checkout_order", {
        p_listing_id: listingId,
        p_buyer_id: buyerIds[winnerIndex % buyerIds.length]!,
        p_quantity: 1,
        p_idempotency_key: keys[winnerIndex]!,
        p_unit_price_paise: quote.unitPricePaise,
        p_buyer_fee_paise: quote.buyerFeePaise,
        p_buyer_fee_gst_paise: quote.buyerFeeGstPaise,
        p_seller_fee_paise: quote.sellerFeePaise,
        p_seller_fee_gst_paise: quote.sellerFeeGstPaise,
        p_total_paise: quote.buyerTotalPaise,
        p_seller_net_paise: quote.sellerNetPaise,
        p_fee_config_id: fees.data.id,
        p_buyer_name: "Concurrency Test",
        p_buyer_phone: "+919876543210",
        p_buyer_state_code: "MH",
        p_buyer_upi_id: "test@okaxis",
        p_payment_method: "upi",
      });
      expect(retry.error).toBeNull();
      expect(retry.data?.id).toBe(winner.id);
      const held = await supabaseAdmin.from("listings").select("status, held_until").eq("id", listingId).single();
      expect(held.data?.status).toBe("held");
      expect(new Date(held.data!.held_until!).getTime() - Date.now()).toBeGreaterThan(9 * 60_000);

      await supabaseAdmin.from("orders").update({ hold_expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", winner.id);
      const expired = await supabaseAdmin.rpc("release_expired_checkouts");
      expect(expired.error).toBeNull();
      // The once-per-minute scheduled reconciler may win this race; either path must cancel and release.
      const cancelled = await supabaseAdmin.from("orders").select("status").eq("id", winner.id).single();
      expect(cancelled.data?.status).toBe("cancelled");
      const released = await supabaseAdmin.from("listings").select("status, held_until").eq("id", listingId).single();
      expect(released.data).toMatchObject({ status: "active", held_until: null });
    } finally {
      if (listingId) await supabaseAdmin.from("orders").delete().eq("listing_id", listingId);
      if (listingId) await supabaseAdmin.from("listings").delete().eq("id", listingId);
      if (eventId) await supabaseAdmin.from("events").delete().eq("id", eventId);
      if (venueId) await supabaseAdmin.from("venues").delete().eq("id", venueId);
      for (const id of userIds) await supabaseAdmin.auth.admin.deleteUser(id);
    }
  }, 45_000);
});
