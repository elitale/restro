import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";

process.env.AUTH_SECRET = "proxy-test-secret";

import { issueMobileBearerToken } from "@/lib/mobile-session";

import { proxy } from "./proxy";

const managerPayload = {
  subjectId: "usr_1",
  kind: "manager" as const,
  restaurantId: "rst_1",
  role: "MANAGER" as const,
};

const makeReq = (
  pathname: string,
  init: { headers?: Record<string, string> } = {},
): NextRequest =>
  new NextRequest(`http://localhost${pathname}`, {
    headers: init.headers,
  });

describe("proxy — mobile API bearer gate", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "proxy-test-secret";
  });

  it.each([
    "/api/mobile/auth/request-otp",
    "/api/mobile/auth/verify-otp",
    "/api/mobile/auth/verify-pin",
  ])("allows the public %s endpoint without a bearer", async (path) => {
    const res = await proxy(makeReq(path));
    expect(res.status).toBe(200); // NextResponse.next() → 200 with no body
  });

  it("returns 401 for a protected mobile route without Authorization header", async () => {
    const res = await proxy(makeReq("/api/mobile/profile"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 for a protected mobile route with a garbage token", async () => {
    const res = await proxy(
      makeReq("/api/mobile/profile", {
        headers: { Authorization: "Bearer not-a-token" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("passes a valid bearer token through", async () => {
    const token = await issueMobileBearerToken(managerPayload);
    const res = await proxy(
      makeReq("/api/mobile/profile", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(res.status).toBe(200);
  });

  it("still redirects unauthenticated page requests to /login", async () => {
    const res = await proxy(makeReq("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });
});
