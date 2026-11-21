import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/health")({
  server: { handlers: { GET: async () => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return Response.json({ status: "unavailable", checks: { database: false } }, { status: 503, headers: { "cache-control": "no-store" } });
    const client = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(input instanceof Request ? input.headers : undefined);
        new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      } },
    });
    const { error } = await client.rpc("current_fee_config").limit(1);
    return Response.json(
      { status: error ? "unavailable" : "ok", checks: { database: !error }, timestamp: new Date().toISOString() },
      { status: error ? 503 : 200, headers: { "cache-control": "no-store" } },
    );
  } } },
});
