import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { istDate } from "@/lib/event-filters";
import { aiExtract, decodeQr } from "./extract.server";
import { ticketFingerprint, findDuplicate, matchEventName, matchDate, matchSeat, trustScore, decide, detectEditingSoftware, sha256Hex } from "./checks";

type ListingRow = { id: string; seller_id: string; event_id: string; section: string | null; seat_info: string | null; status: string };

export async function runVerification(l: ListingRow) {
  if (l.status !== "draft") return { decision: "skipped" as const, score: null, flags: [] as string[], reason: null };
  const { data: sec } = await supabaseAdmin.from("listing_secrets").select("file_path, file_mime").eq("listing_id", l.id).single();
  const { data: ev } = await supabaseAdmin.from("events").select("title, starts_at").eq("id", l.event_id).single();
  if (!sec || !ev) throw new Error("Listing data missing");

  const dl = await supabaseAdmin.storage.from("ticket-proofs").download(sec.file_path);
  if (dl.error || !dl.data) throw new Error("Ticket file missing");
  const bytes = new Uint8Array(await dl.data.arrayBuffer());

  const [qr, ai, fileSha] = await Promise.all([
    Promise.resolve().then(() => decodeQr(bytes, sec.file_mime)),
    aiExtract(bytes, sec.file_mime),
    sha256Hex(bytes),
  ]);

  const fp = await ticketFingerprint({ qr: qr.payload, aiBarcode: ai?.barcode_text ?? null, bookingId: ai?.booking_id ?? null, eventId: l.event_id });

  // duplicate: same QR fingerprint or the exact same file on another live/sold listing
  let duplicate = false;
  if (fp) {
    const { data: same } = await supabaseAdmin.from("listing_secrets").select("listing_id, listing_status_mirror").eq("qr_hash", fp.hash);
    duplicate = !!findDuplicate(l.id, (same ?? []).map((s) => ({ listing_id: s.listing_id, status: s.listing_status_mirror })));
  }
  if (!duplicate) {
    const { data: sameFile } = await supabaseAdmin.from("listing_secrets").select("listing_id, listing_status_mirror").eq("file_sha256", fileSha);
    duplicate = !!findDuplicate(l.id, (sameFile ?? []).map((s) => ({ listing_id: s.listing_id, status: s.listing_status_mirror })));
  }

  const editor = detectEditingSoftware(bytes);
  const signals = {
    aiOk: !!ai,
    isTicket: ai ? ai.is_ticket : null,
    hasFingerprint: !!fp,
    fingerprintSource: fp?.source ?? null,
    name: matchEventName(ai?.event_name, ev.title),
    date: matchDate(ai?.event_date, istDate(new Date(ev.starts_at))),
    seat: matchSeat([ai?.section, ai?.seat].filter(Boolean).join(" "), l.section),
    editingSoftware: !!editor,
    aiLooksEdited: !!ai?.looks_edited,
    photoOfScreen: !!ai?.photo_of_screen,
    screenshotOfScreenshot: !!ai?.screenshot_of_screenshot,
    lowResolution: qr.width != null && qr.height != null && Math.min(qr.width, qr.height) < 400,
  };
  const { score, flags } = trustScore(signals);
  let decision = decide(score, duplicate);
  if (duplicate) flags.unshift("duplicate_ticket");

  const secretUpdate = {
    file_sha256: fileSha,
    qr_hash: duplicate ? null : fp?.hash ?? null,
    qr_source: fp?.source ?? null,
    extracted: (ai ?? {}) as never,
    checks: { ...signals, editor, flags, score, decision, duplicate, checked_at: new Date().toISOString() } as never,
    updated_at: new Date().toISOString(),
  };
  const up = await supabaseAdmin.from("listing_secrets").update(secretUpdate).eq("listing_id", l.id);
  if (up.error?.code === "23505") {
    // another listing claimed this QR concurrently
    decision = "rejected"; duplicate = true; flags.unshift("duplicate_ticket");
    await supabaseAdmin.from("listing_secrets").update({ ...secretUpdate, qr_hash: null }).eq("listing_id", l.id);
  }

  const reason = duplicate ? "This ticket is already listed or sold on PassOn." : decision === "review" ? "Sent for manual review." : null;
  await supabaseAdmin.from("listings").update({
    trust_score: score,
    verification_status: decision,
    status: decision === "approved" ? "active" : decision === "rejected" ? "cancelled" : "draft",
    block_reason: reason,
  }).eq("id", l.id).eq("status", "draft");

  if (duplicate) {
    await supabaseAdmin.from("audit_logs").insert({ actor_id: null, action: "listing.duplicate_blocked", entity: "listing", entity_id: l.id, after: { qr_source: fp?.source ?? "file" } });
  }
  return { decision, score, flags, reason };
}
