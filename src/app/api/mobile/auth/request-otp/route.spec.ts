import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(import("@/services/mobile-auth.service"), async (importOriginal) => ({
  ...(await importOriginal()),
  requestMobileOtp: vi.fn(),
}));

import { requestMobileOtp } from "@/services/mobile-auth.service";

import { POST } from "./route";

const PHONE = "+919876543210";

const makeReq = (body: unknown): Request =>
  new Request("http://localhost/api/mobile/auth/request-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/mobile/auth/request-otp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with the service payload", async () => {
    vi.mocked(requestMobileOtp).mockResolvedValue({
      challengeId: "otp_1",
      resendAvailableAt: "2026-01-01T00:00:00.000Z",
      kind: "manager",
    });

    // The Next request has extra props but our handler only touches Request APIs.
    const res = await POST(
      makeReq({ phone: PHONE }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      challengeId: "otp_1",
      resendAvailableAt: "2026-01-01T00:00:00.000Z",
      kind: "manager",
    });
  });

  it("returns 400 when the phone is malformed", async () => {
    const res = await POST(
      makeReq({
        phone: "nope",
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_INPUT");
    expect(body.fieldErrors?.phone).toBeDefined();
    expect(requestMobileOtp).not.toHaveBeenCalled();
  });

  it("returns 404 when the phone is unknown", async () => {
    vi.mocked(requestMobileOtp).mockRejectedValue(new Error("USER_NOT_FOUND"));

    const res = await POST(
      makeReq({ phone: PHONE }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("USER_NOT_FOUND");
  });

  it("returns 429 when rate-limited", async () => {
    vi.mocked(requestMobileOtp).mockRejectedValue(
      new Error("OTP_RATE_LIMITED"),
    );

    const res = await POST(
      makeReq({ phone: PHONE }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("RATE_LIMITED");
  });

  it("returns 409 on the multi-restaurant case", async () => {
    vi.mocked(requestMobileOtp).mockRejectedValue(
      new Error("MULTI_RESTAURANT_UNSUPPORTED"),
    );

    const res = await POST(
      makeReq({ phone: PHONE }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(409);
  });
});
