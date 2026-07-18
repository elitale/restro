import { describe, expect, it } from "vitest";

import {
  cartLineSchema,
  createOrderSchema,
  settleSchema,
} from "./order";

describe("cartLineSchema", () => {
  it("parses a line and defaults comp/modifiers", () => {
    const parsed = cartLineSchema.parse({ menuItemId: "i1", quantity: 2 });
    expect(parsed.isComp).toBe(false);
    expect(parsed.modifierIds).toEqual([]);
    expect(parsed.quantity).toBe(2);
  });

  it("rejects quantity below 1", () => {
    expect(cartLineSchema.safeParse({ menuItemId: "i1", quantity: 0 }).success).toBe(
      false,
    );
  });
});

describe("createOrderSchema", () => {
  it("requires at least one item and defaults type to TAKEAWAY", () => {
    const parsed = createOrderSchema.parse({
      idempotencyKey: "abcd1234",
      items: [{ menuItemId: "i1", quantity: 1 }],
    });
    expect(parsed.orderType).toBe("TAKEAWAY");
  });

  it("rejects an empty order", () => {
    expect(
      createOrderSchema.safeParse({ idempotencyKey: "abcd1234", items: [] })
        .success,
    ).toBe(false);
  });
});

describe("settleSchema", () => {
  it("accepts a single cash payment", () => {
    const parsed = settleSchema.parse({
      orderId: "o1",
      payments: [{ mode: "CASH", amount: 210, tendered: 500 }],
    });
    expect(parsed.discountType).toBe("NONE");
    expect(parsed.payments).toHaveLength(1);
  });

  it("accepts split tender (cash + UPI)", () => {
    const parsed = settleSchema.parse({
      orderId: "o1",
      payments: [
        { mode: "CASH", amount: 100 },
        { mode: "UPI", amount: 110, reference: "upi-123" },
      ],
    });
    expect(parsed.payments).toHaveLength(2);
  });

  it("requires a discount value when a discount type is set", () => {
    expect(
      settleSchema.safeParse({
        orderId: "o1",
        discountType: "PERCENT",
        payments: [{ mode: "CASH", amount: 100 }],
      }).success,
    ).toBe(false);
  });

  it("requires at least one payment", () => {
    expect(
      settleSchema.safeParse({ orderId: "o1", payments: [] }).success,
    ).toBe(false);
  });
});
