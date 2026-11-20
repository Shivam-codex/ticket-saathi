import { streamText, Output } from "ai";
import { z } from "zod";
import jsQR from "jsqr";
import * as jpeg from "jpeg-js";
import UPNG from "upng-js";
import { createLovableAiGatewayProvider } from "@/lib/ai/gateway.server";

export const extractionSchema = z.object({
  is_ticket: z.boolean(),
  event_name: z.string().nullable(),
  event_date: z.string().nullable().describe("YYYY-MM-DD in India time, or null"),
  venue: z.string().nullable(),
  section: z.string().nullable(),
  seat: z.string().nullable(),
  quantity: z.number().int().nullable(),
  booking_id: z.string().nullable(),
  barcode_text: z.string().nullable().describe("Exact text/number encoded or printed under the QR/barcode, else null"),
  looks_edited: z.boolean(),
  photo_of_screen: z.boolean(),
  screenshot_of_screenshot: z.boolean(),
});
export type Extraction = z.infer<typeof extractionSchema>;

type Raster = { data: Uint8ClampedArray; width: number; height: number };

function decodeRaster(bytes: Uint8Array, mime: string): Raster | null {
  try {
    if (mime === "image/jpeg") {
      const img = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 200, maxResolutionInMP: 40 });
      return { data: new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.byteLength), width: img.width, height: img.height };
    }
    if (mime === "image/png") {
      const img = UPNG.decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
      const rgba = UPNG.toRGBA8(img)[0]!;
      return { data: new Uint8ClampedArray(rgba), width: img.width, height: img.height };
    }
  } catch { /* undecodable */ }
  return null;
}

function downscale(r: Raster, factor: number): Raster {
  const w = Math.floor(r.width / factor), h = Math.floor(r.height / factor);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((y * factor) * r.width + x * factor) * 4, di = (y * w + x) * 4;
    out[di] = r.data[si]!; out[di + 1] = r.data[si + 1]!; out[di + 2] = r.data[si + 2]!; out[di + 3] = 255;
  }
  return { data: out, width: w, height: h };
}

/** Decode a QR code directly from PNG/JPEG pixels. PDFs / WebP rely on the AI read. */
export function decodeQr(bytes: Uint8Array, mime: string): { payload: string | null; width: number | null; height: number | null } {
  const r = decodeRaster(bytes, mime);
  if (!r) return { payload: null, width: null, height: null };
  const px = r.width * r.height;
  const tries = px > 4_000_000 ? [2, 3] : [1, 2];
  for (const f of tries) {
    const img = f === 1 ? r : downscale(r, f);
    const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
    if (hit?.data) return { payload: hit.data, width: r.width, height: r.height };
  }
  return { payload: null, width: r.width, height: r.height };
}

/** Vision read of the ticket via Gemini. Returns null on any failure (caller degrades to admin review). */
export async function aiExtract(bytes: Uint8Array, mime: string): Promise<Extraction | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  try {
    const gateway = createLovableAiGatewayProvider(key, undefined, { baseURL: "https://ai.gateway.lovable.dev/v1", structuredOutputs: true });
    const filePart = mime === "application/pdf"
      ? ({ type: "file", data: bytes, mediaType: "application/pdf", filename: "ticket.pdf" } as const)
      : ({ type: "file", data: bytes, mediaType: mime } as const);
    const result = streamText({
      model: gateway("google/gemini-3-flash-preview"),
      output: Output.object({ schema: extractionSchema }),
      system: [
        "You inspect event tickets (movies, cricket/sports, concerts) uploaded to an Indian resale marketplace.",
        "Extract fields exactly as printed. Dates as YYYY-MM-DD (India time). Use null when not visible. Never guess.",
        "barcode_text: the code printed beneath/near the QR or barcode (or that you can read from it). booking_id: booking / order / confirmation number.",
        "looks_edited: true if text looks pasted, fonts/alignment inconsistent, or values look altered.",
        "photo_of_screen: true if this is a camera photo of a monitor/phone (moiré, glare, perspective).",
        "screenshot_of_screenshot: true if a phone status bar/UI appears nested inside another, or multiple frames/borders.",
        "is_ticket: false if this is not a ticket at all.",
      ].join("\n"),
      messages: [{ role: "user", content: [{ type: "text", text: "Read this ticket." }, filePart] }],
    });
    return await result.output;
  } catch (e) {
    console.error("ticket ai extract failed", e instanceof Error ? e.message : e);
    return null;
  }
}
