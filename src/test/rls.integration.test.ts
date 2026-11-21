import { describe, expect, it } from "vitest";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createTestClient } from "./supabase-test-client";

const hasDatabase = !!(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"] && process.env["SUPABASE_PUBLISHABLE_KEY"]);
const expectedTables = [
  "audit_logs", "consents", "disputes", "event_follows", "events", "feature_flags", "fee_config", "grievance_tickets",
  "launch_invite_redemptions", "launch_invites", "launch_settings", "launch_state_controls", "ledger_entries", "listing_reports",
  "listing_risk_signals", "listing_secrets", "listings", "notifications", "order_events", "orders", "payment_operations",
  "payment_webhook_events", "payouts", "profiles", "resale_rules", "seller_device_signals", "seller_reviews", "tax_config",
  "user_roles", "venues", "waitlist_entries", "waitlist_offers",
];

describe.skipIf(!hasDatabase)("RLS coverage and anonymous access", () => {
  it("enables RLS on every application table", async () => {
    const { data, error } = await supabaseAdmin.rpc("rls_coverage");
    expect(error).toBeNull();
    const rows = data ?? [];
    expect(rows.map((row) => row.table_name).sort()).toEqual([...expectedTables].sort());
    expect(rows.filter((row) => !row.rls_enabled)).toEqual([]);
    const intentionallyServerOnly = new Set(["payment_operations", "payment_webhook_events"]);
    expect(rows.filter((row) => row.policy_count === 0 && !intentionallyServerOnly.has(row.table_name))).toEqual([]);
  });

  it("returns no private rows or privileged RPC access to anonymous callers", async () => {
    const client = createTestClient();
    for (const table of ["profiles", "orders", "listing_secrets", "ledger_entries", "payouts", "disputes", "audit_logs", "launch_invites"] as const) {
      const result = await client.from(table).select("*").limit(1);
      expect(result.data ?? [], table).toEqual([]);
    }
    expect((await client.from("events").select("id").limit(1)).error).toBeNull();
    expect((await client.rpc("current_fee_config")).error).toBeNull();
    expect((await client.rpc("seller_reputation", { _seller_id: crypto.randomUUID() })).error).not.toBeNull();
    expect((await client.rpc("begin_webhook", { p_provider: "razorpay", p_event_id: "forged", p_order_id: crypto.randomUUID(), p_payload_hash: "forged" })).error).not.toBeNull();
  }, 20_000);
});
