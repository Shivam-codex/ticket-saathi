import { describe, it, expect } from "vitest";
import { ticketFingerprint, findDuplicate, matchEventName, matchDate, matchSeat, trustScore, decide, detectEditingSoftware, type TrustSignals } from "./checks";

describe("duplicate QR check", () => {
  it("same QR payload gives the same hash regardless of whitespace", async () => {
    const a = await ticketFingerprint({ qr: "BMS-123 456 789", eventId: "e1" });
    const b = await ticketFingerprint({ qr: "  BMS-123  456\n789 ", eventId: "e2" });
    expect(a?.hash).toBe(b?.hash);
    expect(a?.source).toBe("qr");
  });
  it("different QR payloads give different hashes", async () => {
    const a = await ticketFingerprint({ qr: "TICKET-0001", eventId: "e1" });
    const b = await ticketFingerprint({ qr: "TICKET-0002", eventId: "e1" });
    expect(a?.hash).not.toBe(b?.hash);
  });
  it("hash never contains the raw code", async () => {
    const a = await ticketFingerprint({ qr: "SECRET-QR-PAYLOAD", eventId: "e1" });
    expect(a?.hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("booking-id fallback is scoped per event", async () => {
    const a = await ticketFingerprint({ bookingId: "wx-99812", eventId: "e1" });
    const b = await ticketFingerprint({ bookingId: "WX99812", eventId: "e1" });
    const c = await ticketFingerprint({ bookingId: "WX99812", eventId: "e2" });
    expect(a?.hash).toBe(b?.hash);
    expect(a?.hash).not.toBe(c?.hash);
    expect(a?.source).toBe("booking_id");
  });
  it("returns null when nothing usable was found", async () => {
    expect(await ticketFingerprint({ qr: "", bookingId: "12", eventId: "e1" })).toBeNull();
  });
  it("blocks when another live or sold listing has the same fingerprint", () => {
    expect(findDuplicate("L2", [{ listing_id: "L1", status: "active" }])).not.toBeNull();
    expect(findDuplicate("L2", [{ listing_id: "L1", status: "sold" }])).not.toBeNull();
    expect(findDuplicate("L2", [{ listing_id: "L1", status: "draft" }])).not.toBeNull();
  });
  it("allows relisting after the earlier listing was cancelled or expired", () => {
    expect(findDuplicate("L2", [{ listing_id: "L1", status: "cancelled" }, { listing_id: "L0", status: "expired" }])).toBeNull();
  });
  it("ignores the listing's own fingerprint", () => {
    expect(findDuplicate("L1", [{ listing_id: "L1", status: "active" }])).toBeNull();
  });
  it("a duplicate is always rejected even with a perfect score", () => {
    expect(decide(100, true)).toBe("rejected");
  });
});

describe("matching", () => {
  it("event names", () => {
    expect(matchEventName("TATA IPL 2026 - Pune Warriors v Mumbai Indians", "IPL: Pune Warriors vs Mumbai Indians")).toBe("match");
    expect(matchEventName("Coldplay Music of the Spheres", "IPL: Pune Warriors vs Mumbai Indians")).toBe("mismatch");
    expect(matchEventName(null, "x")).toBe("unknown");
  });
  it("dates", () => {
    expect(matchDate("2026-11-25", "2026-11-25")).toBe("match");
    expect(matchDate("2026-11-26", "2026-11-25")).toBe("mismatch");
    expect(matchDate("25 Nov", "2026-11-25")).toBe("unknown");
  });
  it("seats", () => {
    expect(matchSeat("North Pavilion, Row F, Seat 12", "North Pavilion")).toBe("match");
    expect(matchSeat("East Stand", "Hospitality")).toBe("mismatch");
  });
});

describe("trust score", () => {
  const clean: TrustSignals = { aiOk: true, isTicket: true, hasFingerprint: true, fingerprintSource: "qr", name: "match", date: "match", seat: "match", editingSoftware: false, aiLooksEdited: false, photoOfScreen: false, screenshotOfScreenshot: false, lowResolution: false };
  it("clean ticket auto-approves", () => {
    expect(trustScore(clean).score).toBe(100);
    expect(decide(100, false)).toBe("approved");
  });
  it("edited, mismatched ticket goes to review", () => {
    const r = trustScore({ ...clean, editingSoftware: true, date: "mismatch" });
    expect(r.score).toBe(50);
    expect(r.flags).toEqual(["date_mismatch", "edited_with_software"]);
    expect(decide(r.score, false)).toBe("review");
  });
  it("score never goes below 0", () => {
    expect(trustScore({ ...clean, aiOk: false, isTicket: false, hasFingerprint: false, name: "mismatch", date: "mismatch", seat: "mismatch", editingSoftware: true, aiLooksEdited: true, photoOfScreen: true, screenshotOfScreenshot: true, lowResolution: true }).score).toBe(0);
  });
  it("detects editing software markers", () => {
    expect(detectEditingSoftware(new TextEncoder().encode("xmp:CreatorTool=Adobe Photoshop 25"))).toBe("photoshop");
    expect(detectEditingSoftware(new TextEncoder().encode("plain jpeg"))).toBeNull();
  });
});
