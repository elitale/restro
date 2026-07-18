import { describe, expect, it } from "vitest";

import {
  createMenuCategorySchema,
  createMenuItemSchema,
  createModifierGroupSchema,
  disableItemSchema,
} from "./menu";

describe("createMenuItemSchema", () => {
  const base = { categoryId: "cat_1", name: "Paneer Tikka", price: 250 };

  it("parses a valid item and applies defaults", () => {
    const parsed = createMenuItemSchema.parse(base);
    expect(parsed.itemType).toBe("SERVED");
    expect(parsed.isActive).toBe(true);
    expect(parsed.variants).toEqual([]);
    expect(parsed.modifierGroupIds).toEqual([]);
    expect(parsed.price).toBe(250);
  });

  it("coerces a string price", () => {
    const parsed = createMenuItemSchema.parse({ ...base, price: "199.50" });
    expect(parsed.price).toBe(199.5);
  });

  it("rejects a missing price", () => {
    expect(createMenuItemSchema.safeParse({ categoryId: "c", name: "x" }).success).toBe(false);
  });

  it("rejects a negative price", () => {
    expect(createMenuItemSchema.safeParse({ ...base, price: -1 }).success).toBe(false);
  });
});

describe("createMenuCategorySchema", () => {
  it("rejects an empty name", () => {
    expect(createMenuCategorySchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("createModifierGroupSchema", () => {
  const opts = [{ name: "Oat milk", priceDelta: 30 }];

  it("accepts a valid group", () => {
    const parsed = createModifierGroupSchema.parse({
      name: "Milk",
      minSelect: 1,
      maxSelect: 1,
      modifiers: opts,
    });
    expect(parsed.modifiers).toHaveLength(1);
  });

  it("rejects maxSelect greater than the number of options", () => {
    const result = createModifierGroupSchema.safeParse({
      name: "Milk",
      maxSelect: 3,
      modifiers: opts,
    });
    expect(result.success).toBe(false);
  });

  it("rejects maxSelect below minSelect", () => {
    const result = createModifierGroupSchema.safeParse({
      name: "Milk",
      minSelect: 2,
      maxSelect: 1,
      modifiers: [{ name: "a", priceDelta: 0 }, { name: "b", priceDelta: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a group with no options", () => {
    expect(
      createModifierGroupSchema.safeParse({ name: "Milk", modifiers: [] }).success,
    ).toBe(false);
  });
});

describe("disableItemSchema", () => {
  it("accepts a valid 86 reason", () => {
    const parsed = disableItemSchema.parse({ itemId: "i", reason: "OUT_OF_STOCK" });
    expect(parsed.reason).toBe("OUT_OF_STOCK");
  });

  it("rejects an unknown reason", () => {
    expect(
      disableItemSchema.safeParse({ itemId: "i", reason: "BORED" }).success,
    ).toBe(false);
  });

  it("coerces resumeAt to a Date", () => {
    const parsed = disableItemSchema.parse({
      itemId: "i",
      reason: "PREP_TIME",
      resumeAt: "2026-07-18T18:00:00.000Z",
    });
    expect(parsed.resumeAt).toBeInstanceOf(Date);
  });
});
