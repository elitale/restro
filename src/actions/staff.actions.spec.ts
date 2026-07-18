import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({ getAdminContextOrNull: vi.fn() }));
vi.mock("@/lib/manager-auth", () => ({ getManagerContextOrNull: vi.fn() }));
vi.mock("@/services/staff.service", () => ({
  createStaff: vi.fn(),
  deleteStaff: vi.fn(),
  resetPin: vi.fn(),
  updateStaff: vi.fn(),
}));
vi.mock("@/services/staff-image.service", () => ({
  removeStaffPhoto: vi.fn(),
  uploadStaffPhoto: vi.fn(),
}));

import { getManagerContextOrNull } from "@/lib/manager-auth";
import { createStaff, resetPin } from "@/services/staff.service";
import {
  createStaffAction,
  resetPinAction,
} from "./staff.actions";

const CTX = { userId: "u1", restaurantId: "res_1" };

const validStaff = {
  employeeCode: "E1",
  name: "Ramesh",
  role: "WAITER",
  phone: "9999",
  pin: "1234",
};

describe("staff actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getManagerContextOrNull).mockResolvedValue(CTX);
  });

  it("createStaffAction delegates with the manager context", async () => {
    const result = await createStaffAction(validStaff);

    expect(result.success).toBe(true);
    expect(createStaff).toHaveBeenCalledWith(
      CTX,
      expect.objectContaining({ employeeCode: "E1", role: "WAITER" }),
    );
  });

  it("createStaffAction rejects an invalid PIN", async () => {
    const result = await createStaffAction({ ...validStaff, pin: "12" });

    expect(result.success).toBe(false);
    expect(result.fieldErrors).toBeDefined();
    expect(createStaff).not.toHaveBeenCalled();
  });

  it("resetPinAction delegates the new pin", async () => {
    const result = await resetPinAction({ id: "st1", pin: "5678" });

    expect(result.success).toBe(true);
    expect(resetPin).toHaveBeenCalledWith(
      CTX,
      expect.objectContaining({ id: "st1", pin: "5678" }),
    );
  });

  it("returns NO_RESTAURANT when the manager has no restaurant", async () => {
    vi.mocked(getManagerContextOrNull).mockResolvedValue(null);

    const result = await createStaffAction(validStaff);

    expect(result.success).toBe(false);
    expect(result.error).toBe("NO_RESTAURANT");
  });
});
