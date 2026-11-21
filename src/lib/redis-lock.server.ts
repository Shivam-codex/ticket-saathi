export type RedisConfig = { url: string; token: string };

async function redisCommand(config: RedisConfig, command: unknown[]): Promise<unknown> {
  const response = await fetch(config.url.replace(/\/$/, ""), {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "content-type": "application/json" },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) throw new Error("Redis lock request failed");
  const body = (await response.json()) as { result?: unknown; error?: string };
  if (body.error) throw new Error("Redis lock command failed");
  return body.result;
}

export function checkoutLockKey(listingId: string): string {
  return `passon:checkout:${listingId}`;
}

export async function acquireRedisCheckoutLock(config: RedisConfig, listingId: string, value: string): Promise<boolean> {
  const result = await redisCommand(config, ["SET", checkoutLockKey(listingId), value, "NX", "EX", 600]);
  return result === "OK";
}

export async function releaseRedisCheckoutLock(config: RedisConfig, listingId: string, value: string): Promise<void> {
  await redisCommand(config, [
    "EVAL",
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
    1,
    checkoutLockKey(listingId),
    value,
  ]);
}
