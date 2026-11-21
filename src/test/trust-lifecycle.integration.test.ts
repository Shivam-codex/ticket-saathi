import { describe, expect, it } from "vitest";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calculateOrderQuote } from "@/lib/pricing.server";

const hasDatabase = !!(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]);

describe.skipIf(!hasDatabase)("Phase 6 trust lifecycle database integration", () => {
  it("enforces dispute timing, new-seller limits, takedowns and waitlist offers", async () => {
    const marker = crypto.randomUUID(); const userIds: string[] = []; const listingIds: string[] = [];
    let venueId: string | null = null; let eventId: string | null = null; let orderId: string | null = null; let disputeId: string | null = null;
    try {
      for (let i=0;i<5;i+=1) {
        const created = await supabaseAdmin.auth.admin.createUser({ email:`passon-trust-${marker}-${i}@example.com`,password:crypto.randomUUID(),email_confirm:true });
        if (created.error || !created.data.user) throw created.error ?? new Error("Could not create test user"); userIds.push(created.data.user.id);
      }
      const [sellerId,buyerId,...reporterIds] = userIds as [string,string,string,string,string];
      const venue = await supabaseAdmin.from("venues").insert({name:`Trust test ${marker}`,city:"Pune",state_code:"MH"}).select("id").single();
      if(venue.error)throw venue.error; venueId=venue.data.id;
      const event = await supabaseAdmin.from("events").insert({title:`Trust lifecycle ${marker}`,category:"concert",venue_id:venueId,starts_at:new Date(Date.now()+86_400_000).toISOString(),ends_at:new Date(Date.now()+90_000_000).toISOString(),face_value_tiers:[{name:"General",price_paise:100_000}]}).select("id").single();
      if(event.error)throw event.error; eventId=event.data.id;
      for(let i=0;i<5;i+=1){
        const listing=await supabaseAdmin.from("listings").insert({seller_id:sellerId,event_id:eventId,quantity:i===0?1:6,face_value_paise:100_000,price_paise:100_000,status:"active",verification_status:"approved",trust_score:90}).select("id").single();
        if(listing.error)throw listing.error;listingIds.push(listing.data.id);
      }
      const sixth=await supabaseAdmin.from("listings").insert({seller_id:sellerId,event_id:eventId,quantity:1,face_value_paise:100_000,price_paise:100_000,status:"draft"});
      expect(sixth.error?.message).toContain("NEW_SELLER_DAILY_LIMIT");
      const [firstListingId,reportListingId,waitlistListingId] = listingIds as [string,string,string];
      await supabaseAdmin.from("listing_secrets").insert({listing_id:firstListingId,seller_id:sellerId,file_path:`${sellerId}/${marker}.png`,file_mime:"image/png"});
      const early=await supabaseAdmin.from("disputes").insert({order_id:crypto.randomUUID(),raised_by:buyerId,reason:"Too early"});
      expect(early.error).not.toBeNull();
      const fees=await supabaseAdmin.from("fee_config").select("id,buyer_fee_bps,seller_fee_bps,gst_bps").order("effective_from",{ascending:false}).limit(1).single();
      if(fees.error)throw fees.error;
      const quote=calculateOrderQuote(100_000,1,{buyerFeeBps:fees.data.buyer_fee_bps,sellerFeeBps:fees.data.seller_fee_bps,gstBps:fees.data.gst_bps});
      const order=await supabaseAdmin.rpc("create_checkout_order_v2",{p_listing_id:firstListingId,p_buyer_id:buyerId,p_quantity:1,p_idempotency_key:crypto.randomUUID(),p_unit_price_paise:quote.unitPricePaise,p_buyer_fee_paise:quote.buyerFeePaise,p_buyer_fee_gst_paise:quote.buyerFeeGstPaise,p_seller_fee_paise:quote.sellerFeePaise,p_seller_fee_gst_paise:quote.sellerFeeGstPaise,p_total_paise:quote.buyerTotalPaise,p_seller_net_paise:quote.sellerNetPaise,p_tcs_paise:0,p_tds_paise:0,p_fee_config_id:fees.data.id,p_buyer_name:"Trust Test",p_buyer_phone:"+919876543210",p_buyer_state_code:"MH",p_buyer_upi_id:"buyer@okaxis",p_payment_method:"upi",p_payment_provider:"mock"});
      if(order.error||!order.data?.id)throw order.error??new Error("Order creation failed");orderId=order.data.id;
      const paid=await supabaseAdmin.rpc("record_order_payment",{p_order_id:orderId,p_payment_ref:`mock_${marker}`,p_actor_id:buyerId,p_delivery_hours:24});
      expect(paid.error).toBeNull();
      const beforeStart=await supabaseAdmin.from("disputes").insert({order_id:orderId,raised_by:buyerId,reason:"The event has not started",category:"invalid_ticket",prior_order_status:"ticket_delivered"});
      expect(beforeStart.error?.message).toContain("DISPUTE_WINDOW_CLOSED");
      await supabaseAdmin.from("events").update({starts_at:new Date(Date.now()-3_600_000).toISOString()}).eq("id",eventId);
      const dispute=await supabaseAdmin.from("disputes").insert({order_id:orderId,raised_by:buyerId,reason:"Ticket rejected at the gate",category:"rejected_at_entry",prior_order_status:"ticket_delivered"}).select("id,response_due_at").single();
      expect(dispute.error).toBeNull();disputeId=dispute.data!.id;
      expect(new Date(dispute.data!.response_due_at!).getTime()-Date.now()).toBeGreaterThan(47*3_600_000);
      for(let i=0;i<2;i+=1){const report=await supabaseAdmin.from("listing_reports").insert({listing_id:reportListingId,reporter_id:reporterIds[i]!,reason:"fake_ticket"});expect(report.error).toBeNull();}
      let reported=await supabaseAdmin.from("listings").select("auto_hidden,report_count,status").eq("id",reportListingId).single();
      expect(reported.data).toMatchObject({auto_hidden:false,report_count:2,status:"active"});
      await supabaseAdmin.from("listing_reports").insert({listing_id:reportListingId,reporter_id:reporterIds[2]!,reason:"fake_ticket"});
      reported=await supabaseAdmin.from("listings").select("auto_hidden,report_count,status").eq("id",reportListingId).single();
      expect(reported.data).toMatchObject({auto_hidden:true,report_count:3,status:"draft"});
      await supabaseAdmin.from("event_follows").insert({event_id:eventId,user_id:buyerId,max_price_paise:100_000});
      const waiting=await supabaseAdmin.from("waitlist_entries").insert({event_id:eventId,user_id:buyerId,max_price_paise:100_000,quantity:6}).select("id").single();expect(waiting.error).toBeNull();
      const notified=await supabaseAdmin.rpc("notify_listing_available",{p_listing_id:waitlistListingId});expect(notified.error).toBeNull();
      const offer=await supabaseAdmin.from("waitlist_entries").select("status").eq("id",waiting.data!.id).single();
      expect(offer.data?.status).toBe("offered");
      const offerExpiry=await supabaseAdmin.from("waitlist_offers").select("expires_at").eq("waitlist_id",waiting.data!.id).single();expect(new Date(offerExpiry.data!.expires_at).getTime()-Date.now()).toBeGreaterThan(14*60_000);
      const alerts=await supabaseAdmin.from("notifications").select("kind").eq("user_id",buyerId).eq("kind","waitlist_offer");expect(alerts.data).toHaveLength(1);
    } finally {
      if(disputeId)await supabaseAdmin.from("disputes").delete().eq("id",disputeId);
      if(orderId){await supabaseAdmin.from("payment_operations").delete().eq("order_id",orderId);await supabaseAdmin.from("payment_webhook_events").delete().eq("order_id",orderId);await supabaseAdmin.from("ledger_entries").delete().eq("order_id",orderId);await supabaseAdmin.from("payouts").delete().eq("order_id",orderId);await supabaseAdmin.from("order_events").delete().eq("order_id",orderId);await supabaseAdmin.from("orders").delete().eq("id",orderId);}
      if(listingIds.length){await supabaseAdmin.from("listing_reports").delete().in("listing_id",listingIds);await supabaseAdmin.from("listing_risk_signals").delete().in("listing_id",listingIds);await supabaseAdmin.from("listing_secrets").delete().in("listing_id",listingIds);await supabaseAdmin.from("listings").delete().in("id",listingIds);}
      if(eventId){await supabaseAdmin.from("waitlist_entries").delete().eq("event_id",eventId);await supabaseAdmin.from("event_follows").delete().eq("event_id",eventId);await supabaseAdmin.from("events").delete().eq("id",eventId);}
      for(const id of userIds)await supabaseAdmin.from("notifications").delete().eq("user_id",id);
      if(venueId)await supabaseAdmin.from("venues").delete().eq("id",venueId);
      for(const id of userIds)await supabaseAdmin.auth.admin.deleteUser(id);
    }
  },60_000);
});
