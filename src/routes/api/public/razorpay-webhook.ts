import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

async function payloadHash(raw: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const eventId = request.headers.get("x-razorpay-event-id") ?? `sha256:${await payloadHash(rawBody)}`;
        if (!z.string().min(3).max(255).safeParse(eventId).success) return Response.json({ error: "Invalid event" }, { status: 400 });
        let providerOrderId: string | undefined;
        try {
          const body = z.object({
            payload: z.object({
              payment: z.object({ entity: z.object({ order_id: z.string() }).optional() }).optional(),
              order: z.object({ entity: z.object({ id: z.string() }).optional() }).optional(),
            }),
          }).parse(JSON.parse(rawBody));
          providerOrderId = body.payload.payment?.entity?.order_id ?? body.payload.order?.entity?.id;
        } catch {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }
        if (!providerOrderId) return Response.json({ ok: true, ignored: true });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin.from("orders").select("id").eq("provider_order_ref", providerOrderId).maybeSingle();
        if (!order) return Response.json({ ok: true, ignored: true });
        const hash = await payloadHash(rawBody);
        const begun = await supabaseAdmin.rpc("begin_webhook", { p_provider: "razorpay", p_event_id: eventId, p_order_id: order.id, p_payload_hash: hash });
        if (begun.error) return Response.json({ error: "Could not record event" }, { status: 500 });
        if (!begun.data) return Response.json({ ok: true, duplicate: true });
        try {
          const { getPaymentProvider } = await import("@/lib/payments/provider.server");
          const verified = await getPaymentProvider("razorpay").verifyWebhook({ rawBody, eventId });
          if (verified.providerOrderId !== providerOrderId) throw new Error("Provider order mismatch");
          if (verified.status === "paid") {
            const { confirmRazorpayOrder } = await import("@/lib/payments/process.server");
            await confirmRazorpayOrder(order.id);
          }
          await supabaseAdmin.rpc("finish_webhook", { p_provider: "razorpay", p_event_id: eventId });
          return Response.json({ ok: true });
        } catch (error) {
          console.error("Razorpay webhook processing failed", error);
          await supabaseAdmin.rpc("finish_webhook", { p_provider: "razorpay", p_event_id: eventId, p_error: error instanceof Error ? error.message : "Webhook failed" });
          return Response.json({ error: "Webhook processing failed" }, { status: 500 });
        }
      },
    },
  },
});
