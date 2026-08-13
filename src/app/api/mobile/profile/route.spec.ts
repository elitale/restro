import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.AUTH_SECRET = "profile-route-test-secret";

vi.mock(import("@/services/mobile-auth.service"), async (importOriginal) => ({
  ...(await importOriginal()),
  getMobileUserProfile: vi.fn(),
}));

import { issueMobileBearerToken } from "@/lib/mobile-session";
import { getMobileUserProfile } from "@/services/mobile-auth.service";

import { GET } from "./route";

const managerPayload = {
  subjectId: "usr_1",
  kind: "manager" as const,
  restaurantId: "rst_1",
  role: "MANAGER" as const,
};

const makeReq = (headers: Record<string, string> = {}): Request =>
  new Request("http://localhost/api/mobile/profile", { headers });

describe("GET /api/mobile/profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with the current user profile", async () => {
    vi.mocked(getMobileUserProfile).mockResolvedValue({
      id: "usr_1",
      phone: "+919876543210",
      name: "Rajesh",
      role: "MANAGER",
      kind: "manager",
      restaurantId: "rst_1",
      restaurantName: "Spice Route",
    });
    const token = await issueMobileBearerToken(managerPayload);

    const res = await GET(
      makeReq({
        Authorization: `Bearer ${token}`,
      }) as unknown as import("next/server").NextRequest,
    );

    expect(res.status).toBe(200);
    expect((await res.json()).user).toMatchObject({
      id: "usr_1",
      kind: "manager",
    });
    expect(getMobileUserProfile).toHaveBeenCalledWith(managerPayload);
  });

  it("returns 401 when the bearer header is missing", async () => {
    const res = await GET(
      makeReq() as unknown as import("next/server").NextRequest,
    );
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("UNAUTHORIZED");
    expect(getMobileUserProfile).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer token is invalid", async () => {
    const res = await GET(
      makeReq({
        Authorization: "Bearer not-a-token",
      }) as unknown as import("next/server").NextRequest,
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 when the user has been deleted since token issue", async () => {
    vi.mocked(getMobileUserProfile).mockRejectedValue(
      new Error("USER_NOT_FOUND"),
    );
    const token = await issueMobileBearerToken(managerPayload);

    const res = await GET(
      makeReq({
        Authorization: `Bearer ${token}`,
      }) as unknown as import("next/server").NextRequest,
    );
    expect(res.status).toBe(401);
  });
});
