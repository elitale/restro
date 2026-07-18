import type { BillLineInput } from "@/services/billing";

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
