import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  getAdminContextOrNull: vi.fn(),
}));
vi.mock("@/services/auth.service", () => ({
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));
vi.mock("@/lib/session", () => ({
  createSession: vi.fn(),
  destroySession: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { createSession, destroySession } from "@/lib/session";
import { requestOtp, verifyOtp } from "@/services/auth.service";
import {
  logoutAction,
  requestOtpAction,
  verifyOtpAction,
} from "./auth.actions";

const PHONE = "+919876543210";

describe("requestOtpAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the code for a valid phone", async () => {
    const result = await requestOtpAction({ phone: PHONE });

    expect(result.success).toBe(true);
    expect(requestOtp).toHaveBeenCalledWith(PHONE);
  });

  it("rejects an invalid phone with field errors", async () => {
    const result = await requestOtpAction({ phone: "nope" });

    expect(result.success).toBe(false);
    expect(result.fieldErrors?.phone).toBeDefined();
    expect(requestOtp).not.toHaveBeenCalled();
  });
});

describe("verifyOtpAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies and creates a session", async () => {
    vi.mocked(verifyOtp).mockResolvedValue("usr_1");

    const result = await verifyOtpAction({ phone: PHONE, code: "123456" });

    expect(result.success).toBe(true);
    expect(verifyOtp).toHaveBeenCalledWith(PHONE, "123456");
    expect(createSession).toHaveBeenCalledWith("usr_1");
  });

  it("rejects a malformed code", async () => {
    const result = await verifyOtpAction({ phone: PHONE, code: "12" });

    expect(result.success).toBe(false);
    expect(result.fieldErrors?.code).toBeDefined();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("surfaces a verify failure as an error", async () => {
    vi.mocked(verifyOtp).mockRejectedValue(new Error("OTP_INVALID"));

    const result = await verifyOtpAction({ phone: PHONE, code: "123456" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("OTP_INVALID");
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("logoutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("destroys the session and redirects", async () => {
    await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT");
    expect(destroySession).toHaveBeenCalled();
  });
});
