import { describe, expect, it } from "vitest";

import { emailSchema, idSchema, nameSchema, phoneSchema } from "./shared";

describe("phoneSchema", () => {
  it("accepts a valid E.164 number", () => {
    expect(phoneSchema.parse("+919876543210")).toBe("+919876543210");
  });

  it("trims surrounding whitespace", () => {
    expect(phoneSchema.parse("  +919876543210  ")).toBe("+919876543210");
  });

  it.each(["9876543210", "+0123456789", "+91 98765 43210", "phone", ""])(
    "rejects %j",
    (value) => {
      expect(phoneSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("emailSchema", () => {
  it("trims and lowercases", () => {
    expect(emailSchema.parse("  Asha@Spice.TEST ")).toBe("asha@spice.test");
  });

  it("rejects an invalid email", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
});

describe("nameSchema", () => {
  it("trims", () => {
    expect(nameSchema.parse("  Asha  ")).toBe("Asha");
  });

  it("rejects a blank name", () => {
    expect(nameSchema.safeParse("   ").success).toBe(false);
  });
});

describe("idSchema", () => {
  it("rejects an empty id", () => {
    expect(idSchema.safeParse("").success).toBe(false);
  });
});
