import { z } from "zod";

/** Indian mobile: 10 digits starting 6-9, normalised to E.164 (+91XXXXXXXXXX). */
export function normaliseIndianPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(local) ? `+91${local}` : null;
}

export const upiSchema = z.string().trim().regex(/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/, "Enter a valid UPI ID, e.g. name@okaxis");
export const ifscSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid 11-character IFSC");
export const bankAccountSchema = z.string().trim().regex(/^\d{9,18}$/, "Account number must be 9–18 digits");

export type PayoutInput = { upi?: string | undefined; account?: string | undefined; ifsc?: string | undefined };
/** Seller payout rule: a valid UPI ID, OR a valid bank account + IFSC. */
export function hasValidPayout(p: PayoutInput): boolean {
  if (p.upi && upiSchema.safeParse(p.upi).success) return true;
  return !!p.account && !!p.ifsc && bankAccountSchema.safeParse(p.account).success && ifscSchema.safeParse(p.ifsc).success;
}
/** Seller readiness rule: verified phone AND a valid payout method. */
export function isSellerReady(phoneVerified: boolean, payout: PayoutInput): boolean {
  return phoneVerified && hasValidPayout(payout);
}

export const REQUIRED_CONSENTS = ["terms", "transactions"] as const;
export const OPTIONAL_CONSENTS = ["marketing", "analytics", "personalisation"] as const;
export type ConsentPurpose = (typeof REQUIRED_CONSENTS)[number] | (typeof OPTIONAL_CONSENTS)[number];
export const POLICY_VERSION = "2026-11-21";
export function consentsValid(c: Partial<Record<ConsentPurpose, boolean>>): boolean {
  return REQUIRED_CONSENTS.every((k) => c[k] === true);
}

export const INDIAN_STATES: { code: string; name: string }[] = [
  ["AN","Andaman & Nicobar"],["AP","Andhra Pradesh"],["AR","Arunachal Pradesh"],["AS","Assam"],["BR","Bihar"],["CH","Chandigarh"],["CT","Chhattisgarh"],["DN","Dadra & Nagar Haveli and Daman & Diu"],["DL","Delhi"],["GA","Goa"],["GJ","Gujarat"],["HR","Haryana"],["HP","Himachal Pradesh"],["JK","Jammu & Kashmir"],["JH","Jharkhand"],["KA","Karnataka"],["KL","Kerala"],["LA","Ladakh"],["LD","Lakshadweep"],["MP","Madhya Pradesh"],["MH","Maharashtra"],["MN","Manipur"],["ML","Meghalaya"],["MZ","Mizoram"],["NL","Nagaland"],["OR","Odisha"],["PY","Puducherry"],["PB","Punjab"],["RJ","Rajasthan"],["SK","Sikkim"],["TN","Tamil Nadu"],["TG","Telangana"],["TR","Tripura"],["UP","Uttar Pradesh"],["UT","Uttarakhand"],["WB","West Bengal"],
].map(([code, name]) => ({ code: code!, name: name! }));
