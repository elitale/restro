import { describe, expect, it } from "vitest";

import { computeBill, type BillLineInput } from "./billing";

const line = (overrides: Partial<BillLineInput> = {}): BillLineInput => ({
  unitPrice: 100,
  modifiersDelta: 0,
  quantity: 1,
  taxRate: 0,
  taxInclusive: false,
  isComp: false,
  ...overrides,
});

describe("computeBill", () => {
  it("no tax → total equals gross", () => {
    const bill = computeBill([line({ taxRate: 0 })]);
    expect(bill.subtotal).toBe(100);
    expect(bill.taxTotal).toBe(0);
    expect(bill.grandTotal).toBe(100);
  });

  it("exclusive GST adds tax on top with CGST/SGST split", () => {
    const bill = computeBill([line({ taxRate: 5 })]);
    expect(bill.lines[0]).toMatchObject({
      taxable: 100,
      cgst: 2.5,
      sgst: 2.5,
      tax: 5,
      total: 105,
    });
    expect(bill.taxTotal).toBe(5);
    expect(bill.grandTotal).toBe(105);
  });

  it("inclusive GST backs the tax out of the price", () => {
    const bill = computeBill([
      line({ unitPrice: 105, taxRate: 5, taxInclusive: true }),
    ]);
    expect(bill.lines[0].taxable).toBe(100);
    expect(bill.lines[0].tax).toBe(5);
    expect(bill.grandTotal).toBe(105);
  });

  it("includes modifier deltas and quantity", () => {
    const bill = computeBill([
      line({ unitPrice: 100, modifiersDelta: 30, quantity: 2, taxRate: 5 }),
    ]);
    expect(bill.lines[0].gross).toBe(260);
    expect(bill.taxTotal).toBe(13);
    expect(bill.grandTotal).toBe(273);
  });

  it("comp lines are free and tracked in compTotal", () => {
    const bill = computeBill([
      line({ unitPrice: 200, taxRate: 5 }),
      line({ unitPrice: 150, isComp: true }),
    ]);
    expect(bill.compTotal).toBe(150);
    expect(bill.lines[1].total).toBe(0);
    expect(bill.subtotal).toBe(200);
    expect(bill.grandTotal).toBe(210);
  });

  it("percent discount reduces the taxable base before tax", () => {
    const bill = computeBill([line({ unitPrice: 200, taxRate: 5 })], {
      type: "PERCENT",
      value: 10,
    });
    expect(bill.discountTotal).toBe(20);
    expect(bill.lines[0].taxable).toBe(180);
    expect(bill.taxTotal).toBe(9);
    expect(bill.grandTotal).toBe(189);
  });

  it("flat discount is capped at the subtotal and allocated across lines", () => {
    const bill = computeBill(
      [line({ unitPrice: 100, taxRate: 5 }), line({ unitPrice: 100, taxRate: 5 })],
      { type: "FLAT", value: 50 },
    );
    expect(bill.discountTotal).toBe(50);
    expect(bill.subtotal).toBe(200);
    // 150 net taxable + 7.5 tax = 157.5 → rounds to 158
    expect(bill.grandTotal).toBe(158);
    expect(bill.roundOff).toBeCloseTo(0.5, 2);
  });

  it("rounds the grand total to the nearest rupee", () => {
    const bill = computeBill([line({ unitPrice: 99.4, taxRate: 5 })]);
    // 99.4 + 4.97 = 104.37 → 104
    expect(bill.grandTotal).toBe(104);
    expect(bill.roundOff).toBeCloseTo(-0.37, 2);
  });
});
