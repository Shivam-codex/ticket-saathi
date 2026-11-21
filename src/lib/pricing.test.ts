import { describe, expect, it } from "vitest";
import { basisPoints, calculateOrderQuote } from "./pricing.server";

const defaults = { buyerFeeBps: 500, sellerFeeBps: 500, gstBps: 1800 };

describe("order pricing", () => {
  it("charges Rs 1059 to the buyer and nets Rs 941 to the seller for a Rs 1000 ticket", () => {
    const quote = calculateOrderQuote(100_000, 1, defaults);
    expect(quote).toMatchObject({
      subtotalPaise: 100_000,
      buyerFeePaise: 5_000,
      buyerFeeGstPaise: 900,
      sellerFeePaise: 5_000,
      sellerFeeGstPaise: 900,
      gstOnFeesPaise: 1_800,
      buyerTotalPaise: 105_900,
      sellerNetPaise: 94_100,
    });
  });

  it("multiplies the ticket subtotal by quantity before applying fees", () => {
    const quote = calculateOrderQuote(100_000, 2, defaults);
    expect(quote.buyerTotalPaise).toBe(211_800);
    expect(quote.sellerNetPaise).toBe(188_200);
  });

  it("rounds each fee and its GST to the nearest paise, half up", () => {
    expect(basisPoints(1, 500)).toBe(0);
    expect(basisPoints(10, 500)).toBe(1);
    expect(basisPoints(9, 500)).toBe(0);
    const quote = calculateOrderQuote(101, 1, defaults);
    expect(quote.buyerFeePaise).toBe(5);
    expect(quote.buyerFeeGstPaise).toBe(1);
    expect(quote.buyerTotalPaise).toBe(107);
  });

  it("returns a zero order when the ticket is free", () => {
    expect(calculateOrderQuote(0, 1, defaults)).toMatchObject({
      buyerFeePaise: 0,
      buyerFeeGstPaise: 0,
      buyerTotalPaise: 0,
      sellerNetPaise: 0,
    });
  });

  it("supports zero fees and zero GST", () => {
    const quote = calculateOrderQuote(12_345, 1, { buyerFeeBps: 0, sellerFeeBps: 0, gstBps: 0 });
    expect(quote.buyerTotalPaise).toBe(12_345);
    expect(quote.sellerNetPaise).toBe(12_345);
  });

  it("rejects fractional, negative and unsafe amounts", () => {
    expect(() => calculateOrderQuote(-1, 1, defaults)).toThrow();
    expect(() => calculateOrderQuote(10.5, 1, defaults)).toThrow();
    expect(() => calculateOrderQuote(100, 0, defaults)).toThrow();
    expect(() => calculateOrderQuote(Number.MAX_SAFE_INTEGER, 2, defaults)).toThrow();
  });
});
