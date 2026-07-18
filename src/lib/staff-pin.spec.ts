import { beforeAll, describe, expect, it } from "vitest";

import { hashStaffPin } from "./staff-pin";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret";
});

describe("hashStaffPin", () => {
  it("is deterministic per (restaurant, pin)", () => {
    expect(hashStaffPin("1234", "res_1")).toBe(hashStaffPin("1234", "res_1"));
  });

  it("differs across restaurants and across pins", () => {
    expect(hashStaffPin("1234", "res_1")).not.toBe(hashStaffPin("1234", "res_2"));
    expect(hashStaffPin("1234", "res_1")).not.toBe(hashStaffPin("5678", "res_1"));
  });

  it("does not contain the raw pin", () => {
    expect(hashStaffPin("1234", "res_1")).not.toContain("1234");
  });
});
