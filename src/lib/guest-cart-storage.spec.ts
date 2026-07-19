import { describe, expect, it } from "vitest";

import type { CartLine } from "@/components/pos/types";

import { guestSessionKey, parseGuestSession } from "./guest-cart-storage";

const NOW = 1_000_000_000_000;

const line: CartLine = {
  key: "k1",
  menuItemId: "i1",
  name: "Masala Tea",
  variantId: null,
  variantName: null,
  unitPrice: 50,
  taxRate: 5,
  taxInclusive: false,
  modifiers: [],
  quantity: 2,
  lineNote: null,
  isComp: false,
};

const blob = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ lines: [line], verified: true, updatedAt: NOW, ...over });

describe("guestSessionKey", () => {
  it("scopes by username + table", () => {
    expect(guestSessionKey("elitale", "t1")).toBe(
      "restro.guestsession.elitale.t1",
    );
  });
});

describe("parseGuestSession", () => {
  it("returns a fresh, well-formed session", () => {
    const parsed = parseGuestSession(blob(), NOW + 1000);
    expect(parsed?.lines).toHaveLength(1);
    expect(parsed?.verified).toBe(true);
  });

  it("returns null for a missing blob", () => {
    expect(parseGuestSession(null, NOW)).toBeNull();
  });

  it("returns null once expired (>3h)", () => {
    expect(parseGuestSession(blob(), NOW + 3 * 60 * 60 * 1000 + 1)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseGuestSession("{not json", NOW)).toBeNull();
  });

  it("returns null when lines is not an array", () => {
    expect(parseGuestSession(blob({ lines: "nope" }), NOW)).toBeNull();
  });

  it("defaults verified to false when absent", () => {
    const parsed = parseGuestSession(
      JSON.stringify({ lines: [], updatedAt: NOW }),
      NOW,
    );
    expect(parsed?.verified).toBe(false);
  });
});
