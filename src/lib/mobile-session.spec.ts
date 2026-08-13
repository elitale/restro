import { beforeAll, describe, expect, it } from "vitest";

process.env.AUTH_SECRET = "test-secret-value-mobile";

import {
    issueMobileBearerToken,
    readMobileBearerToken,
    verifyMobileBearerToken,
} from "./mobile-session";

const payload = {
  subjectId: "usr_1",
  kind: "manager" as const,
  restaurantId: "rst_1",
  role: "MANAGER" as const,
};

describe("mobile-session", () => {
  beforeAll(() => {
    // Ensure env is set before jose imports.
    process.env.AUTH_SECRET = "test-secret-value-mobile";
  });

  it("round-trips a signed token", async () => {
    const token = await issueMobileBearerToken(payload);
    expect(typeof token).toBe("string");

    const decoded = await verifyMobileBearerToken(token);
    expect(decoded).toEqual(payload);
  });

  it("returns null for a garbage token", async () => {
    const decoded = await verifyMobileBearerToken("not-a-token");
    expect(decoded).toBeNull();
  });

  it("supports staff kind with null restaurantId", async () => {
    const staffPayload = {
      subjectId: "stf_1",
      kind: "staff" as const,
      restaurantId: null,
      role: "WAITER" as const,
    };
    const token = await issueMobileBearerToken(staffPayload);
    expect(await verifyMobileBearerToken(token)).toEqual(staffPayload);
  });

  it("reads a bearer token from headers", () => {
    const headers = new Headers({ Authorization: "Bearer abc.def.ghi" });
    expect(readMobileBearerToken(headers)).toBe("abc.def.ghi");
  });

  it("returns null when the auth header is missing or malformed", () => {
    expect(readMobileBearerToken(new Headers())).toBeNull();
    expect(
      readMobileBearerToken(new Headers({ Authorization: "Basic xxx" })),
    ).toBeNull();
    expect(
      readMobileBearerToken(new Headers({ Authorization: "Bearer" })),
    ).toBeNull();
  });
});
