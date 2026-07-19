import { describe, expect, it } from "vitest";

import { maskPhone } from "./format";

describe("maskPhone", () => {
  it("shows only the last 3 digits", () => {
    expect(maskPhone("+919876543210")).toBe("••210");
  });

  it("ignores non-digit characters", () => {
    expect(maskPhone("+91 98765 43210")).toBe("••210");
  });

  it("returns empty for a value with no digits", () => {
    expect(maskPhone("")).toBe("");
  });
});
