import { describe, expect, it } from "vitest";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createTestClient } from "./supabase-test-client";

const hasDatabase = !!(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"] && process.env["SUPABASE_PUBLISHABLE_KEY"]);

describe.skipIf(!hasDatabase)("soft launch and privileged-field security", () => {
  it("requires invites, enforces event/state switches and blocks self-verification", async () => {
    const marker = crypto.randomUUID();
    const password = crypto.randomUUID();
    const inviteCode = `TEST-${marker.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const userIds: string[] = [];
    let venueId: string | null = null;
    let eventId: string | null = null;
    let inviteId: string | null = null;
    let listingId: string | null = null;
    try {
      for (let index = 0; index < 2; index += 1) {
        const created = await supabaseAdmin.auth.admin.createUser({
          email: `passon-launch-${marker}-${index}@example.com`, password, email_confirm: true,
          phone: `+9190000${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`, phone_confirm: true,
        });
        if (created.error || !created.data.user) throw created.error ?? new Error("Could not create test user");
        userIds.push(created.data.user.id);
      }
      const [sellerId, buyerId] = userIds as [string, string];
      await supabaseAdmin.from("profiles").update({ payout_upi_id: "seller@okaxis", profile_completed: true }).eq("id", sellerId);
      await supabaseAdmin.from("profiles").update({ profile_completed: true }).eq("id", buyerId);
      await supabaseAdmin.from("user_roles").insert({ user_id: sellerId, role: "seller" });
      const invite = await supabaseAdmin.from("launch_invites").insert({ code: inviteCode, max_uses: 10 }).select("id").single();
      if (invite.error) throw invite.error;
      inviteId = invite.data.id;
      const venue = await supabaseAdmin.from("venues").insert({ name: `Launch security ${marker}`, city: "Test", state_code: "ZZ" }).select("id").single();
      if (venue.error) throw venue.error;
      venueId = venue.data.id;
      const event = await supabaseAdmin.from("events").insert({ title: `Launch security ${marker}`, category: "concert", venue_id: venueId, starts_at: new Date(Date.now() + 86_400_000).toISOString(), face_value_tiers: [{ name: "General", price_paise: 100_000 }], is_resellable: true, soft_launch_allowed: true }).select("id").single();
      if (event.error) throw event.error;
      eventId = event.data.id;
      const seller = createTestClient();
      const buyer = createTestClient();
      const sellerLink = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email: `passon-launch-${marker}-0@example.com` });
      const buyerLink = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email: `passon-launch-${marker}-1@example.com` });
      const sellerToken = sellerLink.data.properties?.hashed_token;
      const buyerToken = buyerLink.data.properties?.hashed_token;
      if (!sellerToken || !buyerToken) throw new Error("Could not create test sessions");
      expect((await seller.auth.verifyOtp({ token_hash: sellerToken, type: "email" })).error).toBeNull();
      expect((await buyer.auth.verifyOtp({ token_hash: buyerToken, type: "email" })).error).toBeNull();

      const blocked = await seller.from("listings").insert({ seller_id: sellerId, event_id: eventId, quantity: 1, face_value_paise: 100_000, price_paise: 100_000, status: "draft" });
      expect(blocked.error).not.toBeNull();
      expect((await seller.rpc("redeem_launch_invite", { p_code: "INVALID-INVITE" })).data).toBe(false);
      expect((await seller.rpc("redeem_launch_invite", { p_code: inviteCode })).data).toBe(true);
      expect((await buyer.rpc("redeem_launch_invite", { p_code: inviteCode })).data).toBe(true);

      const created = await seller.from("listings").insert({ seller_id: sellerId, event_id: eventId, quantity: 1, face_value_paise: 100_000, price_paise: 100_000, status: "draft" }).select("id").single();
      expect(created.error).toBeNull();
      listingId = created.data?.id ?? null;
      expect((await seller.rpc("event_listing_open", { _event_id: eventId })).data).toBe(true);
      await supabaseAdmin.from("events").update({ listings_killed: true }).eq("id", eventId);
      expect((await seller.rpc("event_listing_open", { _event_id: eventId })).data).toBe(false);
      await supabaseAdmin.from("events").update({ listings_killed: false }).eq("id", eventId);
      await supabaseAdmin.from("launch_state_controls").insert({ state_code: "ZZ", listings_enabled: false });
      expect((await seller.rpc("event_listing_open", { _event_id: eventId })).data).toBe(false);

      const selfVerify = await buyer.from("profiles").update({ is_verified: true }).eq("id", buyerId);
      expect(selfVerify.error?.message).toContain("PRIVILEGED_PROFILE_FIELDS");
      expect((await buyer.rpc("is_seller_ready", { _user_id: sellerId })).data).toBe(false);
      expect((await buyer.rpc("seller_reputation", { _seller_id: sellerId })).error).not.toBeNull();
      expect((await buyer.rpc("seller_public_rating", { _seller_id: sellerId })).error).toBeNull();
      expect((await buyer.rpc("begin_webhook", { p_provider: "razorpay", p_event_id: "forged", p_order_id: crypto.randomUUID(), p_payload_hash: "forged" })).error).not.toBeNull();
      await seller.auth.signOut();
      await buyer.auth.signOut();
    } finally {
      if (listingId) await supabaseAdmin.from("listings").delete().eq("id", listingId);
      if (inviteId) {
        await supabaseAdmin.from("launch_invite_redemptions").delete().eq("invite_id", inviteId);
        await supabaseAdmin.from("launch_invites").delete().eq("id", inviteId);
      }
      await supabaseAdmin.from("launch_state_controls").delete().eq("state_code", "ZZ");
      if (eventId) await supabaseAdmin.from("events").delete().eq("id", eventId);
      if (venueId) await supabaseAdmin.from("venues").delete().eq("id", venueId);
      for (const id of userIds) await supabaseAdmin.auth.admin.deleteUser(id);
    }
  }, 45_000);
});
