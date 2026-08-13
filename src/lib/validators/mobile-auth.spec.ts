import { describe, expect, it } from "vitest";

import {
    mobileRequestOtpSchema,
    mobileVerifyOtpSchema,
    mobileVerifyPinSchema,
} from "./mobile-auth";

const PHONE = "+919876543210";

describe("mobileRequestOtpSchema", () => {
  it("accepts an E.164 phone", () => {
    expect(mobileRequestOtpSchema.safeParse({ phone: PHONE }).success).toBe(
      true,
    );
  });

  it("rejects a non-E.164 phone", () => {
    expect(mobileRequestOtpSchema.safeParse({ phone: "98765" }).success).toBe(
      false,
    );
  });
});

describe("mobileVerifyOtpSchema", () => {
  it("accepts a well-formed payload", () => {
    const result = mobileVerifyOtpSchema.safeParse({
      phone: PHONE,
      challengeId: "otp_1",
      code: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("requires a 6-digit numeric code", () => {
    const result = mobileVerifyOtpSchema.safeParse({
      phone: PHONE,
      challengeId: "otp_1",
      code: "12",
    });
    expect(result.success).toBe(false);
  });

  it("requires a challengeId", () => {
    const result = mobileVerifyOtpSchema.safeParse({
      phone: PHONE,
      challengeId: "",
      code: "123456",
    });
    expect(result.success).toBe(false);
  });
});

describe("mobileVerifyPinSchema", () => {
  it("accepts a 4–6 digit PIN", () => {
    expect(
      mobileVerifyPinSchema.safeParse({ phone: PHONE, pin: "4821" }).success,
    ).toBe(true);
    expect(
      mobileVerifyPinSchema.safeParse({ phone: PHONE, pin: "482913" }).success,
    ).toBe(true);
  });

  it("rejects a 3-digit PIN and non-numeric PIN", () => {
    expect(
      mobileVerifyPinSchema.safeParse({ phone: PHONE, pin: "123" }).success,
    ).toBe(false);
    expect(
      mobileVerifyPinSchema.safeParse({ phone: PHONE, pin: "abcd" }).success,
    ).toBe(false);
  });
});
