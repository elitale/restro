import type { KitchenStatus } from "@/lib/kitchen";
import type { OrderType } from "@/types/order";

export type KitchenLineState = "FIRED" | "PREPARING" | "PREPARED";

export interface KitchenTicketLine {
  readonly id: string;
  readonly name: string;
  readonly variantName: string | null;
  readonly quantity: number;
  readonly lineNote: string | null;
  readonly modifiers: readonly string[];
  readonly state: KitchenLineState;
}

export interface KitchenTicketBatch {
  readonly firedAt: string | null;
  /** `true` for items fired after the original ticket (add-ons). */
  readonly isAddOn: boolean;
  /** `true` when this batch was placed by a guest via the self-order page. */
  readonly isSelfOrder: boolean;
  readonly lines: readonly KitchenTicketLine[];
}

export interface KitchenTicketDTO {
  readonly orderId: string;
  readonly orderNumber: number;
  readonly orderType: OrderType;
  readonly tableLabel: string | null;
  readonly status: KitchenStatus;
  readonly firstFiredAt: string | null;
  readonly batches: readonly KitchenTicketBatch[];
  /** Next-step button label ("Start" / "Mark ready"), or `null` when all prepared. */
  readonly advanceLabel: string | null;
}
