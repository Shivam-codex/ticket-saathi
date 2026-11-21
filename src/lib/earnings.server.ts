export type SellerEarningsRow = {
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

export function summariseSellerEarnings(rows: SellerEarningsRow[]) {
  return rows.reduce((summary, row) => ({
    pendingPaise: summary.pendingPaise + (row.status !== "refunded" && row.payoutStatus !== "paid" ? row.sellerNetPaise : 0),
    releasedPaise: summary.releasedPaise + (row.payoutStatus === "paid" ? row.payoutAmountPaise : 0),
    sellerFeesPaise: summary.sellerFeesPaise + row.sellerFeePaise,
    sellerGstPaise: summary.sellerGstPaise + row.sellerFeeGstPaise,
    tcsPaise: summary.tcsPaise + row.tcsPaise,
    tdsPaise: summary.tdsPaise + row.tdsPaise,
  }), { pendingPaise: 0, releasedPaise: 0, sellerFeesPaise: 0, sellerGstPaise: 0, tcsPaise: 0, tdsPaise: 0 });
}
