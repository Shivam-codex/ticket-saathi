import { describe, expect, it } from "vitest";
import { checkRateLimit } from "./rate-limit.server";

describe("temporary per-instance rate limiting", () => {
  it("allows the configured number of attempts and rejects the next", () => {
    const key = crypto.randomUUID();
    expect(checkRateLimit(key, 2, 60_000, 1_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000, 1_001).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000, 1_002)).toEqual({ allowed: false, retryAfterSeconds: 60 });
  });

  it("starts a fresh window after expiry", () => {
    const key = crypto.randomUUID();
    checkRateLimit(key, 1, 100, 1_000);
    expect(checkRateLimit(key, 1, 100, 1_100).allowed).toBe(true);
  });
});
