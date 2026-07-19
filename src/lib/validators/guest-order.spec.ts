import { describe, expect, it } from "vitest";

import {
  guestPlaceOrderSchema,
  guestRequestOtpSchema,
  guestVerifyOtpSchema,
} from "./guest-order";

describe("guestRequestOtpSchema", () => {
  it("accepts a username, table id and E.164 phone", () => {
    const parsed = guestRequestOtpSchema.parse({
      username: "elitale",
      tableId: "t1",
      phone: "+919876543210",
    });
    expect(parsed.phone).toBe("+919876543210");
  });

  it("rejects a non-E.164 phone", () => {
    expect(
      guestRequestOtpSchema.safeParse({
        username: "elitale",
        tableId: "t1",
        phone: "9876543210",
      }).success,
    ).toBe(false);
  });

  it("rejects a missing table id", () => {
    expect(
      guestRequestOtpSchema.safeParse({
        username: "elitale",
        tableId: "",
        phone: "+919876543210",
      }).success,
    ).toBe(false);
  });
});

describe("guestVerifyOtpSchema", () => {
  it("accepts a 6-digit code", () => {
    const parsed = guestVerifyOtpSchema.parse({
      username: "elitale",
      tableId: "t1",
      phone: "+919876543210",
      code: "123456",
    });
    expect(parsed.code).toBe("123456");
  });

  it("rejects a non-6-digit code", () => {
    expect(
      guestVerifyOtpSchema.safeParse({
        username: "elitale",
        tableId: "t1",
        phone: "+919876543210",
        code: "12ab",
      }).success,
    ).toBe(false);
  });
});

describe("guestPlaceOrderSchema", () => {
  it("requires at least one item and an idempotency key", () => {
    const parsed = guestPlaceOrderSchema.parse({
      username: "elitale",
      tableId: "t1",
      idempotencyKey: "abcd1234",
      items: [{ menuItemId: "i1", quantity: 2 }],
    });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.quantity).toBe(2);
  });

  it("rejects an empty cart", () => {
    expect(
      guestPlaceOrderSchema.safeParse({
        username: "elitale",
        tableId: "t1",
        idempotencyKey: "abcd1234",
        items: [],
      }).success,
    ).toBe(false);
  });

  it("rejects a short idempotency key", () => {
    expect(
      guestPlaceOrderSchema.safeParse({
        username: "elitale",
        tableId: "t1",
        idempotencyKey: "short",
        items: [{ menuItemId: "i1", quantity: 1 }],
      }).success,
    ).toBe(false);
  });
});
