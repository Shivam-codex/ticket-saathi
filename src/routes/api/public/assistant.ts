import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from "@/lib/ai/gateway.server";
import { enforceRequestRateLimit } from "@/lib/rate-limit.server";

const bodySchema = z.object({ messages: z.array(z.object({ id: z.string(), role: z.enum(["user","assistant"]), parts: z.array(z.object({ type: z.string() }).passthrough()).max(30) }).passthrough()).min(1).max(20) });
export const Route = createFileRoute("/api/public/assistant")({ server: { handlers: { POST: async ({ request }) => {
  try { enforceRequestRateLimit(request, "assistant", 20, 60_000); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Too many attempts" }, { status: 429 }); }
  let body: z.infer<typeof bodySchema>;
  try { body = bodySchema.parse(await request.json()); } catch { return Response.json({ error: "Please send a shorter valid conversation." }, { status: 400 }); }
  const lastText = body.messages.at(-1)?.parts.filter(p => p.type === "text").map(p => String((p as { text?: unknown }).text ?? "")).join(" ") ?? "";
  if (lastText.length > 2000) return Response.json({ error: "Please keep your question under 2,000 characters." }, { status: 400 });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Sign in to use AI assistance; curated help remains available." }, { status: 401 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return Response.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  const [{ data: flag }, { data: fee }] = await Promise.all([
    supabaseAdmin.from("feature_flags").select("enabled").eq("key","ai_assistant").maybeSingle(),
    supabaseAdmin.from("fee_config").select("buyer_fee_bps,seller_fee_bps,gst_bps").order("effective_from",{ascending:false}).limit(1).maybeSingle(),
  ]);
  if (!flag?.enabled) return Response.json({ error: "AI assistance is currently off. Curated help is available in the widget." }, { status: 403 });
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return Response.json({ error: "AI assistance is not configured. Please use the curated help or contact support." }, { status: 503 });
  const gateway = createLovableAiGatewayProvider(key,getLovableAiGatewayRunId(request),{baseURL:"https://ai.gateway.lovable.dev/v1"});
  const system = `You are PassOn's concise multilingual ticket-marketplace support assistant. Reply in the user's English, Hindi or Marathi. Current configurable fees: buyer ${(fee?.buyer_fee_bps??500)/100}%, seller ${(fee?.seller_fee_bps??500)/100}%, GST ${(fee?.gst_bps??1800)/100}% on each fee. Explain server-calculated prices, ticket discovery, selling steps and Buyer Protection. Never provide legal advice. Never promise, approve or guarantee a refund or payout. Disputes require order evidence and admin review; the usual dispute window is 48 hours after event start. For legal questions, account-specific decisions, payment failures or refund promises, direct the user to /support. Do not claim to have inspected an order, ticket, payment or user identity. No transactions or external actions are available.`;
  try {
    const messages = body.messages as unknown as UIMessage[];
    const result = streamText({ model: gateway.chatModel("google/gemini-3.8-flash"), system, messages: await convertToModelMessages(messages), abortSignal: request.signal });
    const response = result.toUIMessageStreamResponse({ originalMessages: messages, sendReasoning: false, onError: error => { console.error("Assistant stream failed",error); return "The assistant could not complete this answer. Please try again or contact /support."; } });
    return await withLovableAiGatewayRunIdHeader(response,gateway);
  } catch (error) { console.error("Assistant request failed",error); return Response.json({ error: "The assistant is temporarily unavailable. Curated help and support remain available." }, { status: 503 }); }
} } } });
