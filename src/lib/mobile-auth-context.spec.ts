import { beforeAll, describe, expect, it } from "vitest";

process.env.AUTH_SECRET = "mobile-auth-context-test-secret";

import { issueMobileBearerToken } from "@/lib/mobile-session";

import { getMobileAuthOrNull } from "./mobile-auth-context";

const payload = {
  subjectId: "usr_1",
  kind: "manager" as const,
  restaurantId: "rst_1",
  role: "MANAGER" as const,
};

describe("getMobileAuthOrNull", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "mobile-auth-context-test-secret";
  });

  it("returns the payload for a valid bearer token", async () => {
    const token = await issueMobileBearerToken(payload);
    const req = new Request("http://localhost/x", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(await getMobileAuthOrNull(req)).toEqual(payload);
  });

  it("returns null when the header is missing", async () => {
    const req = new Request("http://localhost/x");
    expect(await getMobileAuthOrNull(req)).toBeNull();
  });

  it("returns null when the token is malformed", async () => {
    const req = new Request("http://localhost/x", {
      headers: { Authorization: "Bearer not-a-token" },
    });
    expect(await getMobileAuthOrNull(req)).toBeNull();
  });
});
