import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normaliseIndianPhone, upiSchema } from "@/lib/validation";
import type { RedisConfig } from "@/lib/redis-lock.server";

type Ctx = { supabase: typeof supabase; userId: string };

const listingColumns = "id, seller_id, event_id, section, seat_info, quantity, face_value_paise, price_paise, status, verification_status, trust_score, events(id, title, category, starts_at, ends_at, image_url, is_resellable, venues(name, city, state_code, address))";

async function loadListingQuote(client: typeof supabase, id: string) {
  const { data: listing, error } = await client.from("listings").select(listingColumns).eq("id", id).eq("status", "active").maybeSingle();
  if (error) throw new Error("Could not load listing");
  if (!listing) return null;
  const [fees, stats] = await Promise.all([
    client.from("fee_config").select("id, buyer_fee_bps, seller_fee_bps, gst_bps").order("effective_from", { ascending: false }).limit(1).maybeSingle(),
    client.rpc("seller_public_stats", { _seller_id: listing.seller_id }),
  ]);
  if (!fees.data) throw new Error("Fees are not configured");
  const { calculateOrderQuote } = await import("@/lib/pricing.server");
  const quote = calculateOrderQuote(Number(listing.price_paise), listing.quantity, {
    buyerFeeBps: fees.data.buyer_fee_bps,
    sellerFeeBps: fees.data.seller_fee_bps,
    gstBps: fees.data.gst_bps,
  });
  const sellerStats = stats.data?.[0] ?? null;
  return {
    listing,
    quote,
    feeConfigId: fees.data.id,
    feeConfig: fees.data,
    sellerStats: sellerStats ? {
      averageRating: sellerStats.average_rating == null ? null : Number(sellerStats.average_rating),
      ratingCount: sellerStats.rating_count,
      completedSales: sellerStats.completed_sales,
    } : { averageRating: null, ratingCount: 0, completedSales: 0 },
  };
}

export const getListingDetail = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => loadListingQuote(supabase, data.id));

export const getCheckoutBootstrap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [details, profile] = await Promise.all([
      loadListingQuote(context.supabase, data.id),
      context.supabase.from("profiles").select("full_name, state_code, saved_upi_id, preferred_payment_method").eq("id", context.userId).maybeSingle(),
    ]);
    if (!details) return null;
    if (details.listing.seller_id === context.userId) throw new Error("You cannot buy your own ticket");
    const { configuredPaymentProvider } = await import("@/lib/payments/provider.server");
    const paymentProvider = configuredPaymentProvider();
    let providerReady = true;
    if (paymentProvider === "razorpay") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: seller } = await supabaseAdmin.from("profiles").select("razorpay_route_account_id").eq("id", details.listing.seller_id).maybeSingle();
      providerReady = !!seller?.razorpay_route_account_id;
    }
    return { ...details, profile: profile.data, paymentProvider, providerReady };
  });

const checkoutInput = z.object({
  listing_id: z.string().uuid(),
  idempotency_key: z.string().uuid(),
  buyer_name: z.string().trim().min(2).max(120),
  buyer_phone: z.string().trim().min(10).max(20),
  buyer_upi_id: z.string().trim().max(260).optional(),
});

export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => checkoutInput.parse(d))
  .handler(async ({ data, context }) => {
    const phone = normaliseIndianPhone(data.buyer_phone);
    if (!phone) return { ok: false as const, reason: "invalid_phone" as const };
    const upi = data.buyer_upi_id || null;
    if (upi && !upiSchema.safeParse(upi).success) return { ok: false as const, reason: "invalid_upi" as const };

    const existing = await context.supabase.from("orders").select("id, status, hold_expires_at").eq("idempotency_key", data.idempotency_key).eq("buyer_id", context.userId).maybeSingle();
    if (existing.data) return { ok: true as const, orderId: existing.data.id, status: existing.data.status, holdExpiresAt: existing.data.hold_expires_at, lockBackend: "existing" as const };

    const details = await loadListingQuote(context.supabase, data.listing_id);
    if (!details) return { ok: false as const, reason: "unavailable" as const };
    if (details.listing.seller_id === context.userId) return { ok: false as const, reason: "own_listing" as const };
    const [{ data: profile }, { data: tax }] = await Promise.all([
      context.supabase.from("profiles").select("state_code").eq("id", context.userId).maybeSingle(),
      context.supabase.from("tax_config").select("enabled, tcs_bps, tds_bps").order("effective_from", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const { calculateOrderQuote } = await import("@/lib/pricing.server");
    const q = calculateOrderQuote(Number(details.listing.price_paise), details.listing.quantity, {
      buyerFeeBps: details.feeConfig.buyer_fee_bps,
      sellerFeeBps: details.feeConfig.seller_fee_bps,
      gstBps: details.feeConfig.gst_bps,
      taxEnabled: tax?.enabled ?? false,
      tcsBps: tax?.tcs_bps ?? 0,
      tdsBps: tax?.tds_bps ?? 0,
    });
    const { configuredPaymentProvider } = await import("@/lib/payments/provider.server");
    const provider = configuredPaymentProvider();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (provider === "razorpay") {
      const { data: seller } = await supabaseAdmin.from("profiles").select("razorpay_route_account_id").eq("id", details.listing.seller_id).maybeSingle();
      if (!seller?.razorpay_route_account_id) return { ok: false as const, reason: "provider_unavailable" as const };
    }

    const redisUrl = process.env["UPSTASH_REDIS_REST_URL"];
    const redisToken = process.env["UPSTASH_REDIS_REST_TOKEN"];
    const redis: RedisConfig | null = redisUrl && redisToken ? { url: redisUrl, token: redisToken } : null;
    const redisLock = await import("@/lib/redis-lock.server");
    if (redis) {
      const acquired = await redisLock.acquireRedisCheckoutLock(redis, data.listing_id, data.idempotency_key);
      if (!acquired) return { ok: false as const, reason: "unavailable" as const };
    }

    const result = await supabaseAdmin.rpc("create_checkout_order_v2", {
      p_listing_id: data.listing_id,
      p_buyer_id: context.userId,
      p_quantity: details.listing.quantity,
      p_idempotency_key: data.idempotency_key,
      p_unit_price_paise: q.unitPricePaise,
      p_buyer_fee_paise: q.buyerFeePaise,
      p_buyer_fee_gst_paise: q.buyerFeeGstPaise,
      p_seller_fee_paise: q.sellerFeePaise,
      p_seller_fee_gst_paise: q.sellerFeeGstPaise,
      p_total_paise: q.buyerTotalPaise,
      p_seller_net_paise: q.sellerNetPaise,
      p_tcs_paise: q.tcsPaise,
      p_tds_paise: q.tdsPaise,
      p_fee_config_id: details.feeConfigId,
      p_buyer_name: data.buyer_name,
      p_buyer_phone: phone,
      p_buyer_state_code: profile?.state_code ?? "",
      p_buyer_upi_id: upi ?? "",
      p_payment_method: "upi",
      p_payment_provider: provider,
    });
    const order = result.data as typeof result.data | null;
    if (result.error || !order?.id) {
      if (redis) await redisLock.releaseRedisCheckoutLock(redis, data.listing_id, data.idempotency_key).catch(() => undefined);
      if (result.error) throw new Error("Could not reserve this ticket");
      const retry = await context.supabase.from("orders").select("id, status, hold_expires_at").eq("idempotency_key", data.idempotency_key).eq("buyer_id", context.userId).maybeSingle();
      if (retry.data) return { ok: true as const, orderId: retry.data.id, status: retry.data.status, holdExpiresAt: retry.data.hold_expires_at, lockBackend: redis ? "redis+database" as const : "database" as const };
      return { ok: false as const, reason: "unavailable" as const };
    }

    await context.supabase.from("profiles").update({ saved_upi_id: upi, preferred_payment_method: "upi" }).eq("id", context.userId);
    return { ok: true as const, orderId: order.id, status: order.status, holdExpiresAt: order.hold_expires_at, lockBackend: redis ? "redis+database" as const : "database" as const };
  });

async function readOrder(ctx: Ctx, id: string) {
  const { data, error } = await ctx.supabase.from("orders")
    .select("*, listings(id, section, seat_info, quantity, verification_status, trust_score, events(id, title, starts_at, ends_at, image_url, venues(name, city, state_code, address)))")
    .eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load order");
  return data;
}

async function releaseOrder(ctx: Ctx, order: { id: string; listing_id: string; idempotency_key: string | null }, reason: string, redis: RedisConfig | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("release_checkout_order", { p_order_id: order.id, p_actor_id: ctx.userId, p_reason: reason });
  if (error) throw new Error("Could not release checkout");
  if (redis && order.idempotency_key) {
    const { releaseRedisCheckoutLock } = await import("@/lib/redis-lock.server");
    await releaseRedisCheckoutLock(redis, order.listing_id, order.idempotency_key).catch(() => undefined);
  }
}

function redisFromEnvironment(): RedisConfig | null {
  const url = process.env["UPSTASH_REDIS_REST_URL"];
  const token = process.env["UPSTASH_REDIS_REST_TOKEN"];
  return url && token ? { url, token } : null;
}

export const myOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("orders")
      .select("id, status, quantity, total_paise, seller_net_paise, buyer_id, created_at, hold_expires_at, listings(section, seat_info, events(title, starts_at))")
      .or(`buyer_id.eq.${context.userId},seller_id.eq.${context.userId}`).order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error("Could not load orders");
    return data ?? [];
  });

export const getOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    let order = await readOrder(context, data.id);
    if (!order) return null;
    const isBuyer = order.buyer_id === context.userId;
    if (isBuyer && order.status === "payment_pending" && order.payment_provider === "razorpay" && order.provider_order_ref) {
      const { confirmRazorpayOrder } = await import("@/lib/payments/process.server");
      await confirmRazorpayOrder(order.id, context.userId).catch(() => null);
      order = await readOrder(context, data.id);
      if (!order) return null;
    }
    if (isBuyer && order.status === "payment_pending" && order.hold_expires_at && new Date(order.hold_expires_at).getTime() <= Date.now()) {
      await releaseOrder(context, order, "Reservation expired", redisFromEnvironment());
      order = await readOrder(context, data.id);
      if (!order) return null;
    }
    const [history, review] = await Promise.all([
      context.supabase.from("order_events").select("id, from_status, to_status, note, created_at").eq("order_id", data.id).order("created_at"),
      context.supabase.from("seller_reviews").select("rating, comment").eq("order_id", data.id).maybeSingle(),
    ]);
    let ticket: { url: string; mime: string } | null = null;
    if (isBuyer && ["ticket_delivered", "completed"].includes(order.status)) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: secret } = await supabaseAdmin.from("listing_secrets").select("file_path, file_mime").eq("listing_id", order.listing_id).maybeSingle();
      if (secret) {
        const signed = await supabaseAdmin.storage.from("ticket-proofs").createSignedUrl(secret.file_path, 300);
        if (signed.data?.signedUrl) ticket = { url: signed.data.signedUrl, mime: secret.file_mime };
      }
    }
    return { order, history: history.data ?? [], review: review.data, ticket, isBuyer, viewerId: context.userId };
  });

export const getMockPaymentSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const order = await readOrder(context, data.order_id);
    if (!order || order.buyer_id !== context.userId) throw new Error("Order not found");
    if (order.payment_provider !== "mock") throw new Error("This order uses Razorpay");
    if (order.status !== "payment_pending") throw new Error("This order is not awaiting payment");
    if (!order.hold_expires_at || new Date(order.hold_expires_at).getTime() <= Date.now()) {
      await releaseOrder(context, order, "Reservation expired", redisFromEnvironment());
      throw new Error("This reservation has expired");
    }
    const { mockPaymentAdapter } = await import("@/lib/payments/mock.server");
    return mockPaymentAdapter.createUpiSession({ orderId: order.id, amountPaise: Number(order.total_paise), buyerUpiId: order.buyer_upi_id || null });
  });

export const startRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const order = await readOrder(context, data.order_id);
    if (!order || order.buyer_id !== context.userId || order.payment_provider !== "razorpay" || order.status !== "payment_pending") throw new Error("This order is not awaiting Razorpay payment");
    if (!order.hold_expires_at || new Date(order.hold_expires_at).getTime() <= Date.now()) throw new Error("This reservation has expired");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: seller } = await supabaseAdmin.from("profiles").select("razorpay_route_account_id").eq("id", order.seller_id ?? "").maybeSingle();
    const { getPaymentProvider } = await import("@/lib/payments/provider.server");
    const provider = getPaymentProvider("razorpay");
    let providerOrderId = order.provider_order_ref;
    let keyId = process.env["RAZORPAY_CONNECTION_KEY_ID"] ?? null;
    if (!providerOrderId) {
      const created = await provider.createOrder({
        orderId: order.id,
        amountPaise: Number(order.total_paise),
        sellerAmountPaise: Number(order.seller_net_paise - order.tcs_paise - order.tds_paise),
        sellerRouteAccountId: seller?.razorpay_route_account_id ?? null,
        buyerName: order.buyer_name ?? "",
        buyerPhone: order.buyer_phone ?? "",
      });
      providerOrderId = created.providerOrderId;
      keyId = created.keyId;
      const updated = await supabaseAdmin.from("orders").update({ provider_order_ref: providerOrderId }).eq("id", order.id).eq("status", "payment_pending");
      if (updated.error) throw new Error("Could not save Razorpay order reference");
    }
    return { providerOrderId, keyId, amountPaise: Number(order.total_paise), currency: "INR" as const, buyerName: order.buyer_name ?? "", buyerPhone: order.buyer_phone ?? "" };
  });

export const confirmRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const order = await readOrder(context, data.order_id);
    if (!order || order.buyer_id !== context.userId) throw new Error("Order not found");
    const { confirmRazorpayOrder } = await import("@/lib/payments/process.server");
    const updated = await confirmRazorpayOrder(order.id, context.userId);
    return { ok: true as const, status: updated.status };
  });

export const completeMockPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid(), reference: z.string().regex(/^mock_[a-f0-9]{32}$/), outcome: z.enum(["success", "failure"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const order = await readOrder(context, data.order_id);
    if (!order || order.buyer_id !== context.userId) throw new Error("Order not found");
    if (["paid", "ticket_delivered", "completed"].includes(order.status)) return { ok: true as const, status: order.status };
    if (order.status !== "payment_pending") throw new Error("This order is not awaiting payment");
    const redis = redisFromEnvironment();
    if (data.outcome === "failure") {
      await releaseOrder(context, order, "Mock payment failed", redis);
      return { ok: true as const, status: "cancelled" as const };
    }
    if (!order.hold_expires_at || new Date(order.hold_expires_at).getTime() <= Date.now()) {
      await releaseOrder(context, order, "Reservation expired before payment", redis);
      return { ok: true as const, status: "cancelled" as const };
    }
    const { mockPaymentAdapter } = await import("@/lib/payments/mock.server");
    const payment = mockPaymentAdapter.completeMockPayment(data.reference);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const paid = await supabaseAdmin.rpc("record_order_payment", { p_order_id: order.id, p_payment_ref: payment.providerRef, p_actor_id: context.userId, p_delivery_hours: 24 });
    if (paid.error) throw new Error("Could not confirm payment");
    if (redis && order.idempotency_key) {
      const { releaseRedisCheckoutLock } = await import("@/lib/redis-lock.server");
      await releaseRedisCheckoutLock(redis, order.listing_id, order.idempotency_key).catch(() => undefined);
    }
    return { ok: true as const, status: paid.data.status };
  });

export const cancelCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const order = await readOrder(context, data.order_id);
    if (!order || order.buyer_id !== context.userId) throw new Error("Order not found");
    if (order.status !== "payment_pending") return { ok: true as const };
    await releaseOrder(context, order, "Cancelled by buyer", redisFromEnvironment());
    return { ok: true as const };
  });

export const confirmOrderCompleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("confirm_buyer_entry", { p_order_id: data.order_id, p_buyer_id: context.userId });
    if (error) throw new Error("Entry can be confirmed after the event starts and ticket delivery");
    const { releasePayoutForOrder } = await import("@/lib/payments/process.server");
    const payoutReleased = await releasePayoutForOrder(data.order_id).catch(() => false);
    return { ok: true as const, payoutReleased };
  });

export const reportOrderProblem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid(), reason: z.string().trim().min(5).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const order = await readOrder(context, data.order_id);
    if (!order || order.buyer_id !== context.userId || !["paid", "ticket_delivered"].includes(order.status)) throw new Error("This order cannot be disputed");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dispute = await supabaseAdmin.from("disputes").insert({ order_id: order.id, raised_by: context.userId, reason: data.reason }).select("id").single();
    if (dispute.error) throw new Error("Could not report this problem");
    const transitioned = await supabaseAdmin.rpc("transition_order", { p_order_id: order.id, p_expected: order.status as "paid" | "ticket_delivered", p_next: "disputed", p_actor_id: context.userId, p_note: "Buyer reported a problem" });
    if (transitioned.error) {
      await supabaseAdmin.from("disputes").delete().eq("id", dispute.data.id);
      throw new Error("Could not update this order");
    }
    return { ok: true as const };
  });

export const adminRefundOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid(), note: z.string().trim().min(3).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { refundOrder } = await import("@/lib/payments/process.server");
    await refundOrder(data.order_id, context.userId, data.note);
    return { ok: true as const };
  });

export const reviewSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid(), rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const order = await readOrder(context, data.order_id);
    if (!order || order.buyer_id !== context.userId || !order.seller_id || !["ticket_delivered", "completed"].includes(order.status)) throw new Error("This order cannot be reviewed");
    const { error } = await context.supabase.from("seller_reviews").insert({ order_id: order.id, buyer_id: context.userId, seller_id: order.seller_id, rating: data.rating, comment: data.comment || null });
    if (error) throw new Error("Could not save your review");
    return { ok: true as const };
  });
