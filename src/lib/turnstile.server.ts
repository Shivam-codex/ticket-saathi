import { getRequest } from "@tanstack/react-start/server";

/** Cloudflare verification; an explicit launch flag makes missing keys fail closed. */
export async function verifyTurnstile(token: string | undefined, action: "signup" | "listing") {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  if (!secret) {
    if (process.env["TURNSTILE_REQUIRED"] === "true") throw new Error("Bot protection is not configured");
    return { skipped: true as const };
  }
  if (!token || token.length > 2_048) throw new Error("Please complete the security check");
  const request = getRequest();
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Security verification is temporarily unavailable");
  const result = await response.json() as { success?: boolean; action?: string };
  if (result.success !== true || (result.action != null && result.action !== action)) {
    throw new Error("Security verification failed. Please try again.");
  }
  return { skipped: false as const };
}
