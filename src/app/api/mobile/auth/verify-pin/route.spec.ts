import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock(import("@/services/mobile-auth.service"), async (importOriginal) => ({
  ...(await importOriginal()),
  verifyMobilePin: vi.fn(),
}));

import { verifyMobilePin } from "@/services/mobile-auth.service";

import { POST } from "./route";

const PHONE = "+919876543210";

const makeReq = (body: unknown): Request =>
  new Request("http://localhost/api/mobile/auth/verify-pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/mobile/auth/verify-pin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with token + user on success", async () => {
    vi.mocked(verifyMobilePin).mockResolvedValue({
      token: "signed.jwt.token",
      user: {
        id: "stf_1",
        phone: PHONE,
        name: "Ramesh",
        role: "WAITER",
        kind: "staff",
        restaurantId: "rst_1",
        restaurantName: "Spice Route",
      },
    });

    const res = await POST(
      makeReq({
        phone: PHONE,
        pin: "482913",
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.kind).toBe("staff");
  });

  it("returns 400 with field errors when the pin is malformed", async () => {
    const res = await POST(
      makeReq({
        phone: PHONE,
        pin: "abc",
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors?.pin).toBeDefined();
  });

  it("returns 400 INVALID_PIN on PIN_INVALID", async () => {
    vi.mocked(verifyMobilePin).mockRejectedValue(new Error("PIN_INVALID"));

    const res = await POST(
      makeReq({
        phone: PHONE,
        pin: "000000",
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("INVALID_PIN");
  });

  it("returns 423 on PIN_LOCKED", async () => {
    vi.mocked(verifyMobilePin).mockRejectedValue(new Error("PIN_LOCKED"));

    const res = await POST(
      makeReq({
        phone: PHONE,
        pin: "482913",
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(423);
  });

  it("returns 403 on PIN_NOT_SET", async () => {
    vi.mocked(verifyMobilePin).mockRejectedValue(new Error("PIN_NOT_SET"));

    const res = await POST(
      makeReq({
        phone: PHONE,
        pin: "482913",
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(403);
  });
});
