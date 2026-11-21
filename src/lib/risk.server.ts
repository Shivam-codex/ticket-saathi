import { getRequest } from "@tanstack/react-start/server";

export async function recordSellerDeviceSignal(sellerId: string, listingId: string) {
  const request = getRequest();
  const agent = request.headers.get("user-agent") ?? "unknown";
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const bytes = new TextEncoder().encode(`${agent}|${ip}|passon-device-v1`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const deviceHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,"0")).join("");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("seller_device_signals").insert({ seller_id: sellerId, device_hash: deviceHash });
  const { data: shared } = await supabaseAdmin.from("seller_device_signals").select("seller_id").eq("device_hash", deviceHash).neq("seller_id", sellerId).limit(1);
  if (shared?.length) await supabaseAdmin.from("listing_risk_signals").insert({ listing_id: listingId, seller_id: sellerId, kind: "shared_device", details: { other_seller_id: shared[0]?.seller_id } });
}
