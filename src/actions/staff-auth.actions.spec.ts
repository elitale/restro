import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Restaurant } from "@/generated/prisma/client";

vi.mock("@/lib/admin-auth", () => ({ getAdminContextOrNull: vi.fn() }));
vi.mock("@/lib/manager-auth", () => ({ getManagerContextOrNull: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/staff-session", () => ({
  createStaffSession: vi.fn(),
  destroyStaffSession: vi.fn(),
}));
vi.mock("@/repositories/restaurant.repository", () => ({
  findRestaurantByUsername: vi.fn(),
}));
vi.mock("@/services/staff-auth.service", () => ({
  STAFF_LOGIN_INVALID: "STAFF_LOGIN_INVALID",
  verifyStaffLogin: vi.fn(),
}));

import { redirect } from "next/navigation";
import { createStaffSession, destroyStaffSession } from "@/lib/staff-session";
import { findRestaurantByUsername } from "@/repositories/restaurant.repository";
import { verifyStaffLogin } from "@/services/staff-auth.service";
import { staffLoginAction, staffLogoutAction } from "./staff-auth.actions";

const restaurant = {
  id: "res_1",
  deletedAt: null,
  isActive: true,
} as unknown as Restaurant;

const validInput = { username: "spice12", employeeCode: "E1", pin: "1234" };

describe("staffLoginAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("verifies + opens a staff session on success", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValue(restaurant);
    vi.mocked(verifyStaffLogin).mockResolvedValue({
      staffId: "st1",
      role: "WAITER",
    });

    const result = await staffLoginAction(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ role: "WAITER" });
    expect(verifyStaffLogin).toHaveBeenCalledWith("res_1", "E1", "1234");
    expect(createStaffSession).toHaveBeenCalledWith({
      staffId: "st1",
      restaurantId: "res_1",
      role: "WAITER",
    });
  });

  it("rejects an unknown restaurant without opening a session", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValue(null);

    const result = await staffLoginAction(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe("STAFF_LOGIN_INVALID");
    expect(verifyStaffLogin).not.toHaveBeenCalled();
    expect(createStaffSession).not.toHaveBeenCalled();
  });

  it("surfaces a failed verification generically", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValue(restaurant);
    vi.mocked(verifyStaffLogin).mockRejectedValue(
      new Error("STAFF_LOGIN_INVALID"),
    );

    const result = await staffLoginAction(validInput);

    expect(result.success).toBe(false);
    expect(createStaffSession).not.toHaveBeenCalled();
  });

  it("rejects a malformed pin before hitting the service", async () => {
    const result = await staffLoginAction({ ...validInput, pin: "12" });

    expect(result.success).toBe(false);
    expect(findRestaurantByUsername).not.toHaveBeenCalled();
  });
});

describe("staffLogoutAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clears the session and redirects to the restaurant login", async () => {
    await staffLogoutAction("spice12");

    expect(destroyStaffSession).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/u/spice12/login");
  });
});
