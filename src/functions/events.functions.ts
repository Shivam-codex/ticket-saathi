import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const searchEvents = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ q: z.string().max(80).optional() }).parse(d))
  .handler(async ({ data }) => {
    let query = supabase
      .from("events")
      .select("id, title, category, starts_at, is_resellable, venues(name, city)")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(30);
    const q = data.q?.trim();
    if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error("Could not load events");
    return rows ?? [];
  });
