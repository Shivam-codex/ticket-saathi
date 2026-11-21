import { getRequest } from "@tanstack/react-start/server";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

/** Best-effort fixed-window limiting for one Worker instance, not a global guarantee. */
export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [candidate, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(candidate);
      }
    }
    if (buckets.size >= MAX_BUCKETS) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  existing.count += 1;
  const allowed = existing.count <= limit;
  return { allowed, retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
}

export function enforceUserRateLimit(userId: string, action: string, limit: number, windowMs: number) {
  const request = getRequest();
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const result = checkRateLimit(`${action}:${userId}:${ip}`, limit, windowMs);
  if (!result.allowed) throw new Error(`Too many attempts. Try again in ${result.retryAfterSeconds} seconds.`);
}

export function enforceRequestRateLimit(request: Request, action: string, limit: number, windowMs: number) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const result = checkRateLimit(`${action}:${ip}`, limit, windowMs);
  if (!result.allowed) throw new Error(`Too many attempts. Try again in ${result.retryAfterSeconds} seconds.`);
}
