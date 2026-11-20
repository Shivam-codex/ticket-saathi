import { streamText, Output, NoObjectGeneratedError } from "ai";
import { createLovableAiGatewayProvider } from "./gateway.server";
import { aiFiltersSchema, CITIES, istDate, type AiFilters } from "@/lib/event-filters";

/** Natural-language query → structured filters via Gemini. Returns null on any failure (caller falls back to keyword search). */
export async function parseQueryWithAI(q: string): Promise<AiFilters | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  const today = istDate(new Date());
  const weekday = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  try {
    const gateway = createLovableAiGatewayProvider(key, undefined, { baseURL: "https://ai.gateway.lovable.dev/v1", structuredOutputs: true });
    const result = streamText({
      model: gateway("google/gemini-3-flash-preview"),
      output: Output.object({ schema: aiFiltersSchema }),
      system: [
        "You convert Indian ticket-search queries into filters for a ticket resale marketplace.",
        `Today is ${weekday}, ${today} (India time). Resolve relative dates (tonight, this Sunday, this weekend, next week) to YYYY-MM-DD.`,
        `city: one of ${CITIES.join(", ")} or null. category: movie, sports or concert, or null (IPL, cricket, football, kabaddi = sports; gigs, shows, stand-up = concert; films = movie).`,
        "max_price_rupees: a number if a budget is given; for 'cheap' or 'budget' use 1000. Otherwise null.",
        "keywords: short distinctive words to match event titles (team, artist, movie, league like IPL), else null. Never include city, date or price words in keywords.",
        "Use null for anything not mentioned.",
      ].join("\n"),
      prompt: q.slice(0, 200),
    });
    return await result.output;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) console.warn("AI search: invalid output");
    else console.warn("AI search failed", e instanceof Error ? e.message : e);
    return null;
  }
}
