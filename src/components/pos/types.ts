import { computeBill, type BillLineInput } from "@/services/billing";
import type { OrderDTO } from "@/types/order";

export interface CartModifier {
  readonly id: string;
  readonly name: string;
  readonly priceDelta: number;
}

export interface CartLine {
  readonly key: string;
  readonly menuItemId: string;
  readonly name: string;
  readonly variantId: string | null;
  readonly variantName: string | null;
  readonly unitPrice: number;
  readonly taxRate: number;
  readonly taxInclusive: boolean;
  readonly modifiers: readonly CartModifier[];
  readonly quantity: number;
  readonly lineNote: string | null;
  readonly isComp: boolean;
}

export const modifiersDelta = (mods: readonly CartModifier[]): number =>
  mods.reduce((sum, m) => sum + m.priceDelta, 0);

export const linePrice = (line: CartLine): number =>
  line.isComp
    ? 0
    : (line.unitPrice + modifiersDelta(line.modifiers)) * line.quantity;

export const newLineKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `line-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const toBillLine = (line: CartLine): BillLineInput => ({
  unitPrice: line.unitPrice,
  modifiersDelta: modifiersDelta(line.modifiers),
  quantity: line.quantity,
  taxRate: line.taxRate,
  taxInclusive: line.taxInclusive,
  isComp: line.isComp,
});

/** Running (tax-inclusive) total of a persisted order's non-void lines. */
export const orderRunningTotal = (order: OrderDTO): number =>
  computeBill(
    order.lines
      .filter((l) => l.state !== "VOID")
      .map((l) => ({
        unitPrice: l.unitPrice,
        modifiersDelta: modifiersDelta(l.modifiers),
        quantity: l.quantity,
        taxRate: l.taxRate,
        taxInclusive: l.taxInclusive,
        isComp: l.isComp,
      })),
  ).grandTotal;
