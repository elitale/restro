import { describe, expect, it } from "vitest";

import { addEmailSchema, registerManagerSchema } from "./user";

describe("registerManagerSchema", () => {
  it("accepts a phone with a name", () => {
    expect(
      registerManagerSchema.parse({ phone: "+919876543210", name: "Asha" }),
    ).toEqual({ phone: "+919876543210", name: "Asha" });
  });

  it("accepts a phone without a name", () => {
    expect(registerManagerSchema.parse({ phone: "+919876543210" }).name).toBeUndefined();
  });

  it("rejects an invalid phone", () => {
    expect(registerManagerSchema.safeParse({ phone: "12345" }).success).toBe(
      false,
    );
  });
});

describe("addEmailSchema", () => {
  it("normalises the email", () => {
    expect(addEmailSchema.parse({ email: " Asha@Spice.TEST " })).toEqual({
      email: "asha@spice.test",
    });
  });

  it("rejects an invalid email", () => {
    expect(addEmailSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});
