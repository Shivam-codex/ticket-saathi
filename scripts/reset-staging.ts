import { supabaseAdmin } from "../src/integrations/supabase/client.server";

if (process.env["APP_ENV"] !== "staging" || process.env["CONFIRM_STAGING_RESET"] !== "DELETE_STAGING_FIXTURES") {
  throw new Error("Set APP_ENV=staging and CONFIRM_STAGING_RESET=DELETE_STAGING_FIXTURES");
}
const { data: fixtures, error } = await supabaseAdmin.from("events").select("id,venue_id").like("title", "PassOn staging %");
if (error) throw error;
for (const event of fixtures ?? []) {
  const { data: listings } = await supabaseAdmin.from("listings").select("id").eq("event_id", event.id);
  const listingIds = (listings ?? []).map((listing) => listing.id);
  if (listingIds.length) {
    const { data: orders } = await supabaseAdmin.from("orders").select("id").in("listing_id", listingIds);
    const orderIds = (orders ?? []).map((order) => order.id);
    if (orderIds.length) {
      await supabaseAdmin.from("disputes").delete().in("order_id", orderIds);
      await supabaseAdmin.from("payment_operations").delete().in("order_id", orderIds);
      await supabaseAdmin.from("payment_webhook_events").delete().in("order_id", orderIds);
      await supabaseAdmin.from("ledger_entries").delete().in("order_id", orderIds);
      await supabaseAdmin.from("payouts").delete().in("order_id", orderIds);
      await supabaseAdmin.from("order_events").delete().in("order_id", orderIds);
      await supabaseAdmin.from("orders").delete().in("id", orderIds);
    }
    await supabaseAdmin.from("listing_reports").delete().in("listing_id", listingIds);
    await supabaseAdmin.from("listing_risk_signals").delete().in("listing_id", listingIds);
    await supabaseAdmin.from("listing_secrets").delete().in("listing_id", listingIds);
    await supabaseAdmin.from("listings").delete().in("id", listingIds);
  }
  await supabaseAdmin.from("event_follows").delete().eq("event_id", event.id);
  await supabaseAdmin.from("waitlist_entries").delete().eq("event_id", event.id);
  await supabaseAdmin.from("events").delete().eq("id", event.id);
}
console.log(`Removed ${fixtures?.length ?? 0} isolated staging event fixtures; other data was not touched.`);
