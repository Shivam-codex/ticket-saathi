import { expect, test, type Page } from "@playwright/test";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { createTestClient } from "../src/test/supabase-test-client";

const hasDatabase = !!(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"] && process.env["SUPABASE_PUBLISHABLE_KEY"]);
test.skip(!hasDatabase, "Requires an isolated test backend");

async function authenticate(page: Page, email: string, password: string) {
  const link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data.properties?.hashed_token;
  if (!tokenHash) throw new Error("Could not create browser test session");
  const client = createTestClient();
  const verified = await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (verified.error || !verified.data.session) throw verified.error ?? new Error("Missing browser session");
  const publicUrl = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"]!;
  const projectRef = new URL(publicUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  await page.goto("/auth");
  await page.evaluate(([key, session]) => window.localStorage.setItem(key!, session!), [storageKey, JSON.stringify(verified.data.session)]);
}

test("signup to listing, mock purchase, dispute and refund", async ({ page: sellerPage, browser }) => {
  const marker = crypto.randomUUID();
  const password = crypto.randomUUID();
  const inviteCode = `E2E-${marker.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const title = `E2E launch ${marker.slice(0, 8)}`;
  const userIds: string[] = [];
  let venueId: string | null = null;
  let eventId: string | null = null;
  let inviteId: string | null = null;
  let listingId: string | null = null;
  let orderId: string | null = null;
  let buyerPage: Page | null = null;
  let adminPage: Page | null = null;
  try {
    for (let index = 0; index < 3; index += 1) {
      const created = await supabaseAdmin.auth.admin.createUser({
        email: `passon-e2e-${marker}-${index}@example.com`, password, email_confirm: true,
        phone: `+9191000${String(Math.floor(Math.random() * 100000)).padStart(5, "0")}`, phone_confirm: true,
        data: { full_name: `E2E User ${index}` },
      });
      if (created.error || !created.data.user) throw created.error ?? new Error("Could not create test user");
      userIds.push(created.data.user.id);
    }
    const [sellerId, buyerId, adminId] = userIds as [string, string, string];
    await supabaseAdmin.from("profiles").update({ payout_upi_id: "e2e@okaxis", full_name: "E2E Seller", profile_completed: true, state_code: "ZZ" }).eq("id", sellerId);
    await supabaseAdmin.from("profiles").update({ full_name: "E2E Admin", profile_completed: true }).eq("id", adminId);
    await supabaseAdmin.from("user_roles").insert([{ user_id: sellerId, role: "seller" }, { user_id: adminId, role: "admin" }]);
    const invite = await supabaseAdmin.from("launch_invites").insert({ code: inviteCode, max_uses: 10 }).select("id").single();
    if (invite.error) throw invite.error;
    inviteId = invite.data.id;
    const venue = await supabaseAdmin.from("venues").insert({ name: `E2E Venue ${marker}`, city: "Pune", state_code: "ZZ" }).select("id").single();
    if (venue.error) throw venue.error;
    venueId = venue.data.id;
    const event = await supabaseAdmin.from("events").insert({ title, category: "concert", venue_id: venueId, starts_at: new Date(Date.now() + 86_400_000).toISOString(), ends_at: new Date(Date.now() + 90_000_000).toISOString(), face_value_tiers: [{ name: "General", price_paise: 100_000 }], is_resellable: true, soft_launch_allowed: true }).select("id").single();
    if (event.error) throw event.error;
    eventId = event.data.id;

    await authenticate(sellerPage, `passon-e2e-${marker}-0@example.com`, password);
    await sellerPage.goto("/sell");
    await expect(sellerPage.getByRole("heading", { name: "Sell a ticket", exact: true })).toBeVisible();
    await sellerPage.getByLabel("Search your event").fill(title);
    await sellerPage.getByRole("button", { name: new RegExp(title) }).click();
    await sellerPage.getByLabel("Section / stand").selectOption("General");
    await sellerPage.getByLabel("Row and seat numbers").fill("Row A, Seat 1");
    await sellerPage.getByRole("button", { name: "Next", exact: true }).click();
    await sellerPage.locator('input[type="file"]').setInputFiles({ name: "ticket.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF") });
    await sellerPage.getByRole("button", { name: "Next", exact: true }).click();
    await sellerPage.getByLabel("Price you paid (per ticket)").fill("1000");
    await sellerPage.getByLabel("Asking price (per ticket)").fill("1000");
    await sellerPage.getByLabel("Soft-launch invite").fill(inviteCode);
    await sellerPage.getByRole("checkbox").check();
    await sellerPage.getByRole("button", { name: "List ticket", exact: true }).click();
    await expect(sellerPage.getByText("Verifying your ticket…")).toBeVisible();
    const createdListing = await supabaseAdmin.from("listings").select("id").eq("seller_id", sellerId).eq("event_id", eventId).order("created_at", { ascending: false }).limit(1).single();
    if (createdListing.error) throw createdListing.error;
    listingId = createdListing.data.id;
    await sellerPage.close();
    await supabaseAdmin.from("listings").update({ status: "active", verification_status: "approved", trust_score: 100 }).eq("id", listingId);

    buyerPage = await browser.newPage();
    await authenticate(buyerPage, `passon-e2e-${marker}-1@example.com`, password);
    await buyerPage.goto(`/listings/${listingId}`);
    await buyerPage.getByRole("link", { name: /Reserve & continue/ }).click();
    await expect(buyerPage).toHaveURL(/\/onboarding/);
    await buyerPage.getByLabel("Full name").fill("E2E Buyer");
    await buyerPage.getByRole("combobox").first().click();
    await buyerPage.getByRole("option", { name: "Maharashtra" }).click();
    await buyerPage.getByRole("checkbox").nth(0).check();
    await buyerPage.getByRole("checkbox").nth(1).check();
    await buyerPage.getByRole("button", { name: "Save and continue" }).click();
    await expect(buyerPage).toHaveURL(/\/settings/);
    await buyerPage.goto(`/listings/${listingId}`);
    await buyerPage.getByRole("link", { name: /Reserve & continue/ }).click();
    await buyerPage.getByLabel("Full name").fill("E2E Buyer");
    await buyerPage.getByLabel("Mobile number").fill("9876543210");
    await buyerPage.getByLabel("Soft-launch invite").fill(inviteCode);
    await buyerPage.getByRole("button", { name: "Reserve tickets & continue" }).click();
    await expect(buyerPage).toHaveURL(/\/orders\//);
    orderId = buyerPage.url().split("/").pop() ?? null;
    await buyerPage.getByRole("button", { name: "Show UPI payment options" }).click();
    await buyerPage.getByRole("button", { name: "Simulate successful payment" }).click();
    await expect(buyerPage.getByText("Your tickets are ready", { exact: true })).toBeVisible();

    await supabaseAdmin.from("events").update({ starts_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", eventId);
    await buyerPage.reload();
    await buyerPage.getByPlaceholder("Describe what happened at entry or with your ticket…").fill("The ticket was rejected at the entry gate.");
    await buyerPage.getByRole("button", { name: "Submit for review" }).click();
    await expect(buyerPage.getByText("open", { exact: true })).toBeVisible();

    adminPage = await browser.newPage();
    await authenticate(adminPage, `passon-e2e-${marker}-2@example.com`, password);
    await adminPage.goto("/admin/disputes");
    const disputeCard = adminPage.locator("article").filter({ hasText: title });
    await expect(disputeCard).toBeVisible();
    await disputeCard.getByRole("button", { name: "Refund buyer" }).click();
    await expect(adminPage.getByText("Decision saved and audit logged")).toBeVisible();
    if (!orderId) throw new Error("Order ID missing");
    const refunded = await supabaseAdmin.from("orders").select("status").eq("id", orderId).single();
    expect(refunded.data?.status).toBe("refunded");
  } finally {
    await Promise.all([sellerPage.close().catch(() => undefined), buyerPage?.close().catch(() => undefined), adminPage?.close().catch(() => undefined)]);
    if (orderId) {
      await supabaseAdmin.from("disputes").delete().eq("order_id", orderId);
      await supabaseAdmin.from("payment_operations").delete().eq("order_id", orderId);
      await supabaseAdmin.from("payment_webhook_events").delete().eq("order_id", orderId);
      await supabaseAdmin.from("ledger_entries").delete().eq("order_id", orderId);
      await supabaseAdmin.from("payouts").delete().eq("order_id", orderId);
      await supabaseAdmin.from("order_events").delete().eq("order_id", orderId);
      await supabaseAdmin.from("orders").delete().eq("id", orderId);
    }
    if (listingId) {
      await supabaseAdmin.from("listing_reports").delete().eq("listing_id", listingId);
      await supabaseAdmin.from("listing_risk_signals").delete().eq("listing_id", listingId);
      await supabaseAdmin.from("listing_secrets").delete().eq("listing_id", listingId);
      await supabaseAdmin.from("listings").delete().eq("id", listingId);
    }
    if (inviteId) {
      await supabaseAdmin.from("launch_invite_redemptions").delete().eq("invite_id", inviteId);
      await supabaseAdmin.from("launch_invites").delete().eq("id", inviteId);
    }
    if (eventId) await supabaseAdmin.from("events").delete().eq("id", eventId);
    if (venueId) await supabaseAdmin.from("venues").delete().eq("id", venueId);
    for (const id of userIds) await supabaseAdmin.auth.admin.deleteUser(id);
  }
});
