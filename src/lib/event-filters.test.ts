import { describe, expect, it } from "vitest";
import { normaliseAiFilters, resolveDateRange } from "./event-filters";

// Thu 20 Nov 2026, 18:00 UTC = Thu 23:30 IST
const now = new Date("2026-11-20T18:00:00Z");

describe("date windows (IST)", () => {
  it("weekend covers Sat 21 and Sun 22 Nov in IST", () => {
    const r = resolveDateRange({ when: "weekend" }, now);
    expect(r.from.toISOString()).toBe("2026-11-20T18:30:00.000Z"); // Sat 00:00 IST
    expect(r.to?.toISOString()).toBe("2026-11-22T18:30:00.000Z"); // Mon 00:00 IST
  });
  it("today ends at IST midnight", () => {
    expect(resolveDateRange({ when: "today" }, now).to?.toISOString()).toBe("2026-11-20T18:30:00.000Z");
  });
  it("explicit to-date is inclusive of that IST day", () => {
    expect(resolveDateRange({ from: "2026-11-23", to: "2026-11-23" }, now).to?.toISOString()).toBe("2026-11-23T18:30:00.000Z");
  });
  it("never returns past events", () => {
    expect(resolveDateRange({ from: "2026-01-01" }, now).from).toEqual(now);
  });
});

describe("AI filter normalisation", () => {
  it("maps 'cheap IPL tickets in Pune' style output", () => {
    expect(normaliseAiFilters({ city: "pune", category: "Sports", max_price_rupees: 1500, date_from: "2026-11-22", date_to: "2026-11-22", keywords: "IPL" }))
      .toEqual({ city: "Pune", category: "sports", maxPrice: 1500, from: "2026-11-22", to: "2026-11-22", q: "IPL" });
  });
  it("accepts Bangalore as Bengaluru and drops unknown cities/categories", () => {
    expect(normaliseAiFilters({ city: "Bangalore", category: "opera", max_price_rupees: null, date_from: "tomorrow", date_to: null, keywords: null }))
      .toEqual({ city: "Bengaluru" });
  });
});
