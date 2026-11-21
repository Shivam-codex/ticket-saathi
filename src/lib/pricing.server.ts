export type FeeConfig = {
  buyerFeeBps: number;
  sellerFeeBps: number;
  gstBps: number;
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
  if (!Number.isSafeInteger(buyerTotalPaise)) throw new Error("Buyer total exceeds safe integer range");
  if (sellerNetPaise < 0) throw new Error("Seller fees cannot exceed the ticket subtotal");

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
  };
}
