import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET = "mobile-logout-test-secret";

import { issueMobileBearerToken } from "@/lib/mobile-session";

import { POST } from "./route";

const makeReq = (headers: Record<string, string> = {}): Request =>
  new Request("http://localhost/api/mobile/auth/logout", {
    method: "POST",
    headers,
  });

describe("POST /api/mobile/auth/logout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 204 for a valid bearer token", async () => {
    const token = await issueMobileBearerToken({
      subjectId: "usr_1",
      kind: "manager",
      restaurantId: "rst_1",
      role: "MANAGER",
    });

    const res = await POST(
      makeReq({
        Authorization: `Bearer ${token}`,
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(204);
  });

  it("returns 401 when the header is missing", async () => {
    const res = await POST(
      makeReq() as unknown as import("next/server").NextRequest,
    );
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
  });

  it("returns 401 for a garbage token", async () => {
    const res = await POST(
      makeReq({
        Authorization: "Bearer not-a-token",
      }) as unknown as import("next/server").NextRequest,
    );
    expect(res.status).toBe(401);
  });
});
