import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(import("@/services/mobile-auth.service"), async (importOriginal) => ({
  ...(await importOriginal()),
  verifyMobileOtp: vi.fn(),
}));

import { verifyMobileOtp } from "@/services/mobile-auth.service";

import { POST } from "./route";

const PHONE = "+919876543210";

const makeReq = (body: unknown): Request =>
  new Request("http://localhost/api/mobile/auth/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/mobile/auth/verify-otp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with token + user on success", async () => {
    vi.mocked(verifyMobileOtp).mockResolvedValue({
      token: "signed.jwt.token",
      user: {
        id: "usr_1",
        phone: PHONE,
        name: "Rajesh",
        role: "MANAGER",
        kind: "manager",
        restaurantId: "rst_1",
        restaurantName: "Spice Route",
      },
    });

    const res = await POST(
      makeReq({
        phone: PHONE,
        challengeId: "otp_1",
        code: "123456",
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe("signed.jwt.token");
    expect(body.user.kind).toBe("manager");
  });

  it("returns 400 with field errors when the code is malformed", async () => {
    const res = await POST(
      makeReq({
        phone: PHONE,
        challengeId: "otp_1",
        code: "12",
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors?.code).toBeDefined();
  });

  it("returns 400 INVALID_CODE on OTP_INVALID", async () => {
    vi.mocked(verifyMobileOtp).mockRejectedValue(new Error("OTP_INVALID"));

    const res = await POST(
      makeReq({
        phone: PHONE,
        challengeId: "otp_1",
        code: "999999",
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_CODE");
  });

  it("returns 410 on OTP_EXPIRED", async () => {
    vi.mocked(verifyMobileOtp).mockRejectedValue(new Error("OTP_EXPIRED"));

    const res = await POST(
      makeReq({
        phone: PHONE,
        challengeId: "otp_1",
        code: "123456",
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(410);
  });

  it("returns 429 on OTP_LOCKED", async () => {
    vi.mocked(verifyMobileOtp).mockRejectedValue(new Error("OTP_LOCKED"));

    const res = await POST(
      makeReq({
        phone: PHONE,
        challengeId: "otp_1",
        code: "123456",
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(429);
  });
});
