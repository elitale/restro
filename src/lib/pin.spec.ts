import { describe, expect, it } from "vitest";

import { hashPin, verifyPin } from "./pin";

describe("pin hashing", () => {
  it("verifies a correct pin round-trip", () => {
    const stored = hashPin("123456");
    expect(verifyPin("123456", stored)).toBe(true);
  });

  it("rejects an incorrect pin", () => {
    const stored = hashPin("1234");
    expect(verifyPin("9999", stored)).toBe(false);
  });

  it("uses a unique salt per hash (same pin → different output)", () => {
    expect(hashPin("1234")).not.toBe(hashPin("1234"));
  });

  it("rejects blank or malformed stored values", () => {
    expect(verifyPin("1234", "")).toBe(false);
    expect(verifyPin("1234", "nonsense")).toBe(false);
    expect(verifyPin("1234", "scrypt$abc")).toBe(false);
    expect(verifyPin("1234", "bcrypt$aa$bb")).toBe(false);
  });
});
