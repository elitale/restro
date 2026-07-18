export type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";
export type OrderStatus = "OPEN" | "COMPLETED" | "VOID";
export type OrderLineState = "UNSENT" | "FIRED" | "SERVED" | "VOID";
export type PaymentMode = "CASH" | "UPI" | "CARD" | "OTHER";

export interface OrderLineModifierDTO {
  readonly id: string;
  readonly name: string;
  readonly priceDelta: number;
}

export interface OrderLineDTO {
  readonly id: string;
  readonly name: string;
  readonly variantName: string | null;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly lineNote: string | null;
  readonly state: OrderLineState;
  readonly isComp: boolean;
  readonly taxRate: number;
  readonly taxInclusive: boolean;
  readonly modifiers: readonly OrderLineModifierDTO[];
}

export interface OrderPaymentDTO {
  readonly id: string;
  readonly mode: PaymentMode;
  readonly amount: number;
  readonly tendered: number | null;
  readonly reference: string | null;
}

export interface OrderDTO {
  readonly id: string;
  readonly orderNumber: number;
  readonly invoiceNumber: number | null;
  readonly orderType: OrderType;
  readonly status: OrderStatus;
  readonly tableLabel: string | null;
  readonly tableId: string | null;
  readonly customerName: string | null;
  readonly customerPhone: string | null;
  readonly customerAddress: string | null;
  readonly note: string | null;
  readonly subtotal: number;
  readonly taxTotal: number;
  readonly discountTotal: number;
  readonly compTotal: number;
  readonly roundOff: number;
  readonly grandTotal: number;
  readonly createdAt: string;
  readonly settledAt: string | null;
  readonly lines: readonly OrderLineDTO[];
  readonly payments: readonly OrderPaymentDTO[];
}

export interface TodaySalesDTO {
  readonly orders: number;
  readonly gross: number;
  readonly tax: number;
  readonly discount: number;
  readonly voids: number;
  readonly byMode: readonly { mode: string; amount: number; count: number }[];
}
