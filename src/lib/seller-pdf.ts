import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";

export type SellerPdfRow = {
  orderId: string;
  eventTitle: string;
  createdAt: string;
  status: string;
  ticketSubtotalPaise: number;
  sellerFeePaise: number;
  sellerFeeGstPaise: number;
  tcsPaise: number;
  tdsPaise: number;
  sellerNetPaise: number;
  feeInvoiceTotalPaise: number;
  feeInvoiceNumber: string;
  payoutStatus: string;
  payoutAmountPaise: number;
  payoutRef: string | null;
};

export type SellerPdfLabels = {
  statementTitle: string; invoiceTitle: string; draft: string; order: string; event: string; status: string;
  pending: string; subtotal: string; fee: string; gst: string; tcs: string; tds: string; net: string; payout: string; total: string; compliance: string;
};

type Summary = { pendingPaise: number; releasedPaise: number; sellerFeesPaise: number; sellerGstPaise: number; tcsPaise: number; tdsPaise: number };

const ascii = (value: string) => value.replace(/[^\x20-\x7E]/g, "?");
const money = (paise: number) => `INR ${(paise / 100).toFixed(2)}`;

function line(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size = 10) {
  page.drawText(ascii(text), { x, y, size, font, color: rgb(0.12, 0.12, 0.12) });
}

async function documentWithFont() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  return { pdf, font, bold };
}

function save(pdf: PDFDocument, bytes: Uint8Array, filename: string) {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  void pdf;
}

export async function downloadSellerStatementPdf(rows: SellerPdfRow[], summary: Summary, labels: SellerPdfLabels) {
  const { pdf, font, bold } = await documentWithFont();
  let page = pdf.addPage([595, 842]);
  page.drawText(ascii(labels.statementTitle), { x: 42, y: 790, size: 20, font: bold, color: rgb(0.1, 0.1, 0.1) });
  line(page, font, `PassOn · ${new Date().toISOString().slice(0, 10)}`, 42, 770, 9);
  line(page, font, `${labels.pending ?? "Pending"}: ${money(summary.pendingPaise)}`, 42, 742, 11);
  line(page, font, `${labels.payout}: ${money(summary.releasedPaise)}`, 300, 742, 11);
  line(page, font, `${labels.fee}: ${money(summary.sellerFeesPaise)} · ${labels.gst}: ${money(summary.sellerGstPaise)}`, 42, 722, 10);
  line(page, font, `${labels.tcs}: ${money(summary.tcsPaise)} · ${labels.tds}: ${money(summary.tdsPaise)}`, 42, 704, 10);
  line(page, font, labels.compliance, 42, 678, 8);
  let y = 646;
  for (const row of rows) {
    if (y < 105) {
      page = pdf.addPage([595, 842]);
      y = 780;
    }
    page.drawLine({ start: { x: 42, y: y + 72 }, end: { x: 553, y: y + 72 }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75) });
    line(page, bold, `${row.eventTitle} · ${row.feeInvoiceNumber}`, 42, y + 52, 11);
    line(page, font, `${labels.order}: ${row.orderId}`, 42, y + 34, 8);
    line(page, font, `${labels.status}: ${row.status} · ${labels.payout}: ${row.payoutStatus}`, 42, y + 18, 9);
    line(page, font, `${labels.subtotal}: ${money(row.ticketSubtotalPaise)} · ${labels.fee}: ${money(row.sellerFeePaise)} · ${labels.gst}: ${money(row.sellerFeeGstPaise)}`, 42, y, 9);
    line(page, font, `${labels.tcs}: ${money(row.tcsPaise)} · ${labels.tds}: ${money(row.tdsPaise)} · ${labels.net}: ${money(row.sellerNetPaise)}`, 42, y - 16, 9);
    y -= 100;
  }
  save(pdf, await pdf.save(), `passon-seller-statement-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function downloadSellerFeeInvoicePdf(row: SellerPdfRow, labels: SellerPdfLabels) {
  const { pdf, font, bold } = await documentWithFont();
  const page = pdf.addPage([595, 842]);
  page.drawText("PassOn", { x: 48, y: 778, size: 25, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(ascii(labels.invoiceTitle), { x: 350, y: 778, size: 15, font: bold, color: rgb(0.1, 0.1, 0.1) });
  line(page, bold, labels.draft, 48, 744, 10);
  line(page, font, row.feeInvoiceNumber, 350, 754, 10);
  line(page, font, `${labels.order}: ${row.orderId}`, 48, 696, 10);
  line(page, font, `${labels.event}: ${row.eventTitle}`, 48, 678, 10);
  line(page, font, `${labels.status}: ${row.status}`, 48, 660, 10);
  page.drawLine({ start: { x: 48, y: 630 }, end: { x: 547, y: 630 }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
  const items = [
    [labels.subtotal, row.ticketSubtotalPaise],
    [labels.fee, row.sellerFeePaise],
    [labels.gst, row.sellerFeeGstPaise],
    [labels.tcs, row.tcsPaise],
    [labels.tds, row.tdsPaise],
  ] as const;
  let y = 600;
  for (const [label, amount] of items) {
    line(page, font, label, 48, y, 11);
    line(page, font, money(amount), 430, y, 11);
    y -= 28;
  }
  line(page, bold, labels.total, 48, y - 10, 13);
  line(page, bold, money(row.feeInvoiceTotalPaise), 420, y - 10, 13);
  line(page, bold, labels.net, 48, y - 52, 12);
  line(page, bold, money(row.sellerNetPaise), 420, y - 52, 12);
  line(page, font, `${labels.payout}: ${row.payoutStatus} · ${row.payoutRef ?? "—"}`, 48, 220, 9);
  line(page, font, labels.compliance, 48, 190, 8);
  line(page, font, "Platform legal name, GSTIN and registered address: not configured. Not valid for tax credit.", 48, 174, 8);
  save(pdf, await pdf.save(), `${row.feeInvoiceNumber}.pdf`);
}
