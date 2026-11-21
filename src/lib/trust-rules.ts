export const DISPUTE_WINDOW_HOURS = 48;
export const NEW_SELLER_DAILY_LIMIT = 5;
export const AUTO_HIDE_REPORT_COUNT = 3;
export const WAITLIST_AUTO_OFFER_HOURS = 24;

export function canRaiseDispute(startsAt: string | Date, at: Date = new Date()) {
  const start = startsAt instanceof Date ? startsAt.getTime() : new Date(startsAt).getTime();
  const now = at.getTime();
  return Number.isFinite(start) && now >= start && now <= start + DISPUTE_WINDOW_HOURS * 3_600_000;
}
export function shouldAutoHideListing(reportCount: number) { return Number.isInteger(reportCount) && reportCount >= AUTO_HIDE_REPORT_COUNT; }
export function newSellerCanList(profileCreatedAt: string | Date, listingsToday: number, at: Date = new Date()) {
  const created = profileCreatedAt instanceof Date ? profileCreatedAt.getTime() : new Date(profileCreatedAt).getTime();
  if (!Number.isInteger(listingsToday) || listingsToday < 0 || !Number.isFinite(created)) return false;
  return created <= at.getTime() - 30 * 86_400_000 || listingsToday < NEW_SELLER_DAILY_LIMIT;
}
export function waitlistMatches(pricePaise: number, maxPricePaise: number, available: number, requested: number) {
  return Number.isInteger(pricePaise) && pricePaise >= 0 && pricePaise <= maxPricePaise && Number.isInteger(requested) && requested >= 1 && requested <= 6 && available >= requested;
}
