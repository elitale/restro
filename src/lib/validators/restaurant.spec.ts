import { describe, expect, it } from "vitest";

import { updateTaxProfileSchema } from "./restaurant";

describe("updateTaxProfileSchema", () => {
  it("accepts an unregistered profile without a rate", () => {
    expect(
      updateTaxProfileSchema.safeParse({ gstRegistrationType: "UNREGISTERED" })
        .success,
    ).toBe(true);
  });

  it("requires a rate when registered as regular", () => {
    expect(
      updateTaxProfileSchema.safeParse({ gstRegistrationType: "REGULAR" })
        .success,
    ).toBe(false);
  });

  it("coerces the rate and uppercases the GSTIN", () => {
    const parsed = updateTaxProfileSchema.parse({
      gstRegistrationType: "REGULAR",
      serviceGstRate: "18",
      gstin: "22aaaaa0000a1z5",
    });
    expect(parsed.serviceGstRate).toBe(18);
    expect(parsed.gstin).toBe("22AAAAA0000A1Z5");
  });

  it("rejects a malformed GSTIN", () => {
    expect(
      updateTaxProfileSchema.safeParse({
        gstRegistrationType: "REGULAR",
        serviceGstRate: 5,
        gstin: "too-short",
      }).success,
    ).toBe(false);
  });
});
