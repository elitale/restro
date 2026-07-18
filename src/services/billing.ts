/**
 * Pure bill math for POS orders. No IO — deterministic so it can run client-side
 * (offline-ready) and is exhaustively unit-tested. Money in rupees, 2 decimals;
 * grand total rounds to the nearest ₹1.
 */

export interface BillLineInput {
  readonly unitPrice: number;
  readonly modifiersDelta: number;
  readonly quantity: number;
  readonly taxRate: number; // percent
  readonly taxInclusive: boolean;
  readonly isComp: boolean;
}

export type DiscountKind = "NONE" | "PERCENT" | "FLAT";

export interface DiscountInput {
  readonly type: DiscountKind;
  readonly value: number;
}

export interface BillLineResult {
  readonly gross: number;
  readonly discount: number;
  readonly taxable: number;
  readonly cgst: number;
  readonly sgst: number;
  readonly tax: number;
  readonly total: number;
}

export interface BillResult {
  readonly lines: readonly BillLineResult[];
  readonly subtotal: number;
  readonly discountTotal: number;
  readonly taxTotal: number;
  readonly compTotal: number;
  readonly roundOff: number;
  readonly grandTotal: number;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const NO_DISCOUNT: DiscountInput = { type: "NONE", value: 0 };

export const computeBill = (
  lines: readonly BillLineInput[],
  discount: DiscountInput = NO_DISCOUNT,
): BillResult => {
  // 1. Pre-tax base per line (back out tax for inclusive pricing).
  const bases = lines.map((l) => {
    const gross = round2((l.unitPrice + l.modifiersDelta) * l.quantity);
    if (l.isComp) {
      return { gross, base: 0, comp: gross };
    }
    const base =
      l.taxInclusive && l.taxRate > 0
        ? round2(gross / (1 + l.taxRate / 100))
        : gross;
    return { gross, base, comp: 0 };
  });

  const subtotal = round2(bases.reduce((s, b) => s + b.base, 0));
  const compTotal = round2(bases.reduce((s, b) => s + b.comp, 0));

  // 2. Target discount on the pre-tax base.
  const targetDiscount =
    discount.type === "PERCENT"
      ? round2((subtotal * discount.value) / 100)
      : discount.type === "FLAT"
        ? Math.min(round2(discount.value), subtotal)
        : 0;

  // 3. Allocate discount proportionally, then tax the discounted base.
  const resultLines: BillLineResult[] = lines.map((l, i) => {
    const { gross, base } = bases[i];
    if (l.isComp || base === 0) {
      return { gross, discount: 0, taxable: 0, cgst: 0, sgst: 0, tax: 0, total: 0 };
    }
    const lineDiscount =
      subtotal > 0 ? round2((base / subtotal) * targetDiscount) : 0;
    const taxable = round2(base - lineDiscount);
    const tax = round2((taxable * l.taxRate) / 100);
    const cgst = round2(tax / 2);
    const sgst = round2(tax - cgst);
    const total = round2(taxable + tax);
    return { gross, discount: lineDiscount, taxable, cgst, sgst, tax, total };
  });

  const netTaxable = round2(resultLines.reduce((s, l) => s + l.taxable, 0));
  const discountTotal = round2(subtotal - netTaxable);
  const taxTotal = round2(resultLines.reduce((s, l) => s + l.tax, 0));
  const preRound = round2(netTaxable + taxTotal);
  const grandTotal = Math.round(preRound);
  const roundOff = round2(grandTotal - preRound);

  return {
    lines: resultLines,
    subtotal,
    discountTotal,
    taxTotal,
    compTotal,
    roundOff,
    grandTotal,
  };
};
