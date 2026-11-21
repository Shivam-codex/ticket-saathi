import { describe, expect, it } from "vitest";
import { canTransition } from "./order-state";

describe("order state machine", () => {
  it("follows created to payment pending to paid to ticket delivered to completed", () => {
    expect(canTransition("pending", "payment_pending")).toBe(true);
    expect(canTransition("payment_pending", "paid")).toBe(true);
    expect(canTransition("paid", "ticket_delivered")).toBe(true);
    expect(canTransition("ticket_delivered", "completed")).toBe(true);
  });

  it("allows timeout cancellation only before payment", () => {
    expect(canTransition("payment_pending", "cancelled")).toBe(true);
    expect(canTransition("paid", "cancelled")).toBe(false);
  });

  it("allows disputes and refunds after payment but not before", () => {
    expect(canTransition("payment_pending", "disputed")).toBe(false);
    expect(canTransition("ticket_delivered", "disputed")).toBe(true);
    expect(canTransition("disputed", "refunded")).toBe(true);
  });

  it("does not reopen completed, refunded or cancelled orders", () => {
    expect(canTransition("completed", "paid")).toBe(false);
    expect(canTransition("refunded", "paid")).toBe(false);
    expect(canTransition("cancelled", "payment_pending")).toBe(false);
  });
});
