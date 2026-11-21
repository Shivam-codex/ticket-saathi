export type FeeConfig = {
  buyerFeeBps: number;
  sellerFeeBps: number;
  gstBps: number;
  /** Disabled by default; rates and applicability require CA confirmation. */
  taxEnabled?: boolean;
  tcsBps?: number;
  tdsBps?: number;
};

export type OrderQuote = {
  quantity: number;
  unitPricePaise: number;
  subtotalPaise: number;
  buyerFeePaise: number;
  buyerFeeGstPaise: number;
  sellerFeePaise: number;
  sellerFeeGstPaise: number;
  gstOnFeesPaise: number;
  buyerTotalPaise: number;
  sellerNetPaise: number;
  tcsPaise: number;
  tdsPaise: number;
  sellerPayoutPaise: number;
};

function integer(value: number, name: string, min = 0): void {
  if (!Number.isSafeInteger(value) || value < min) throw new Error(`${name} must be a safe integer >= ${min}`);
}

/** Round a non-negative basis-point charge to the nearest paise, half up. */
export function basisPoints(amountPaise: number, bps: number): number {
  integer(amountPaise, "amountPaise");
  integer(bps, "bps", 0);
  const result = (BigInt(amountPaise) * BigInt(bps) + 5_000n) / 10_000n;
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Charge exceeds safe integer range");
  return Number(result);
}

/** Single source of truth for every buyer, seller and GST amount on an order. */
export function calculateOrderQuote(unitPricePaise: number, quantity: number, config: FeeConfig): OrderQuote {
  integer(unitPricePaise, "unitPricePaise");
  integer(quantity, "quantity", 1);
  if (quantity > 6) throw new Error("Group checkout is limited to 6 tickets");
  integer(config.buyerFeeBps, "buyerFeeBps");
  integer(config.sellerFeeBps, "sellerFeeBps");
  integer(config.gstBps, "gstBps");
  if (config.buyerFeeBps > 10_000 || config.sellerFeeBps > 10_000 || config.gstBps > 10_000) {
    throw new Error("Fee and GST rates cannot exceed 100%");
  }

  const subtotalBig = BigInt(unitPricePaise) * BigInt(quantity);
  if (subtotalBig > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Subtotal exceeds safe integer range");
  const subtotalPaise = Number(subtotalBig);
  const buyerFeePaise = basisPoints(subtotalPaise, config.buyerFeeBps);
  const sellerFeePaise = basisPoints(subtotalPaise, config.sellerFeeBps);
  const buyerFeeGstPaise = basisPoints(buyerFeePaise, config.gstBps);
  const sellerFeeGstPaise = basisPoints(sellerFeePaise, config.gstBps);
  const buyerTotalPaise = subtotalPaise + buyerFeePaise + buyerFeeGstPaise;
  const sellerNetPaise = subtotalPaise - sellerFeePaise - sellerFeeGstPaise;
  const taxEnabled = config.taxEnabled ?? false;
  const tcsPaise = taxEnabled ? basisPoints(subtotalPaise, config.tcsBps ?? 0) : 0;
  const tdsPaise = taxEnabled ? basisPoints(subtotalPaise, config.tdsBps ?? 0) : 0;
  const sellerPayoutPaise = sellerNetPaise - tcsPaise - tdsPaise;
  if (!Number.isSafeInteger(buyerTotalPaise)) throw new Error("Buyer total exceeds safe integer range");
  if (sellerNetPaise < 0 || sellerPayoutPaise < 0) throw new Error("Seller fees and taxes cannot exceed the ticket subtotal");

  return {
    quantity,
    unitPricePaise,
    subtotalPaise,
    buyerFeePaise,
    buyerFeeGstPaise,
    sellerFeePaise,
    sellerFeeGstPaise,
    gstOnFeesPaise: buyerFeeGstPaise + sellerFeeGstPaise,
    buyerTotalPaise,
    sellerNetPaise,
    tcsPaise,
    tdsPaise,
    sellerPayoutPaise,
  };
}
