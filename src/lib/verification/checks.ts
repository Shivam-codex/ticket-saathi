/** Pure ticket-verification helpers (no I/O) — unit tested. */

export const LIVE_STATUSES = ["draft", "active", "held", "sold"] as const;

export function normaliseCode(raw: string): string {
  return raw.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type QrSource = "qr" | "ai_barcode" | "booking_id";

/** Fingerprint a ticket. Real QR payloads are global; booking IDs are scoped to the event. */
export async function ticketFingerprint(opts: { qr?: string | null; aiBarcode?: string | null; bookingId?: string | null; eventId: string }): Promise<{ hash: string; source: QrSource } | null> {
  const qr = opts.qr ? normaliseCode(opts.qr) : "";
  if (qr.length >= 4) return { hash: await sha256Hex(`qr:${qr}`), source: "qr" };
  const bc = opts.aiBarcode ? normaliseCode(opts.aiBarcode) : "";
  if (bc.length >= 6) return { hash: await sha256Hex(`qr:${bc}`), source: "ai_barcode" };
  const bk = opts.bookingId ? normaliseCode(opts.bookingId).toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
  if (bk.length >= 5) return { hash: await sha256Hex(`bk:${opts.eventId}:${bk}`), source: "booking_id" };
  return null;
}

export type ExistingFingerprint = { listing_id: string; status: string };

/** Duplicate if any OTHER listing with the same fingerprint is still live or sold. */
export function findDuplicate(listingId: string, existing: ExistingFingerprint[]): ExistingFingerprint | null {
  return existing.find((e) => e.listing_id !== listingId && (LIVE_STATUSES as readonly string[]).includes(e.status)) ?? null;
}

/* ---------- matching ---------- */

export type MatchResult = "match" | "mismatch" | "unknown";

const STOP = new Set(["the", "vs", "v", "and", "live", "in", "at", "of", "a", "&", "-", "ticket", "tickets", "show"]);
function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\u0900-\u097f ]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
}

export function matchEventName(extracted: string | null | undefined, title: string): MatchResult {
  if (!extracted?.trim()) return "unknown";
  const a = new Set(tokens(extracted));
  const b = tokens(title);
  if (!a.size || !b.length) return "unknown";
  const hit = b.filter((w) => a.has(w)).length;
  return hit / b.length >= 0.5 || hit >= 2 ? "match" : "mismatch";
}

export function matchDate(extractedYmd: string | null | undefined, eventIstYmd: string): MatchResult {
  if (!extractedYmd || !/^\d{4}-\d{2}-\d{2}$/.test(extractedYmd)) return "unknown";
  return extractedYmd === eventIstYmd ? "match" : "mismatch";
}

export function matchSeat(extracted: string | null | undefined, listed: string | null | undefined): MatchResult {
  const x = (extracted ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const y = (listed ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!x || !y) return "unknown";
  return x.includes(y) || y.includes(x) || tokens(y).some((w) => tokens(x).includes(w)) ? "match" : "mismatch";
}

/* ---------- trust score ---------- */

export type TrustSignals = {
  aiOk: boolean;
  isTicket: boolean | null;
  hasFingerprint: boolean;
  fingerprintSource: QrSource | null;
  name: MatchResult;
  date: MatchResult;
  seat: MatchResult;
  editingSoftware: boolean;
  aiLooksEdited: boolean;
  photoOfScreen: boolean;
  screenshotOfScreenshot: boolean;
  lowResolution: boolean;
};

export function trustScore(s: TrustSignals): { score: number; flags: string[] } {
  let score = 100;
  const flags: string[] = [];
  const hit = (n: number, flag: string) => { score -= n; flags.push(flag); };
  if (!s.aiOk) hit(20, "ai_unavailable");
  if (s.isTicket === false) hit(40, "not_a_ticket");
  if (!s.hasFingerprint) hit(30, "no_qr_or_booking_id");
  else if (s.fingerprintSource === "booking_id") hit(5, "booking_id_only");
  if (s.name === "mismatch") hit(25, "event_name_mismatch"); else if (s.name === "unknown") hit(10, "event_name_unreadable");
  if (s.date === "mismatch") hit(25, "date_mismatch"); else if (s.date === "unknown") hit(5, "date_unreadable");
  if (s.seat === "mismatch") hit(15, "seat_mismatch");
  if (s.editingSoftware) hit(25, "edited_with_software");
  if (s.aiLooksEdited) hit(20, "looks_edited");
  if (s.photoOfScreen) hit(10, "photo_of_screen");
  if (s.screenshotOfScreenshot) hit(15, "screenshot_of_screenshot");
  if (s.lowResolution) hit(10, "low_resolution");
  return { score: Math.max(0, Math.min(100, score)), flags };
}

export const AUTO_APPROVE_SCORE = 75;
export type Decision = "approved" | "review" | "rejected";
export function decide(score: number, duplicate: boolean): Decision {
  if (duplicate) return "rejected";
  return score >= AUTO_APPROVE_SCORE ? "approved" : "review";
}

/** Look for editing-software markers in image metadata (EXIF/XMP/PNG text chunks). */
const EDITORS = ["photoshop", "gimp", "snapseed", "picsart", "canva", "pixlr", "lightroom", "affinity", "paint.net", "facetune", "remini"];
export function detectEditingSoftware(bytes: Uint8Array): string | null {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 131072))).toLowerCase();
  return EDITORS.find((e) => head.includes(e)) ?? null;
}
