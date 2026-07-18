import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  getAdminContextOrNull: vi.fn(),
}));
vi.mock("@/lib/manager-auth", () => ({
  getManagerContextOrNull: vi.fn(),
}));
vi.mock("@/services/restaurant.service", () => ({
  onboardRestaurant: vi.fn(),
}));

import { getAdminContextOrNull } from "@/lib/admin-auth";
import { onboardRestaurant } from "@/services/restaurant.service";
import { onboardRestaurantAction } from "./restaurant.actions";

describe("onboardRestaurantAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns Forbidden without an admin context", async () => {
    vi.mocked(getAdminContextOrNull).mockResolvedValue(null);

    const result = await onboardRestaurantAction({
      name: "Spice Route",
      ownerPhone: "+919876543210",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Forbidden");
    expect(onboardRestaurant).not.toHaveBeenCalled();
  });

  it("returns validation errors for a bad payload", async () => {
    vi.mocked(getAdminContextOrNull).mockResolvedValue({
      userId: "adm_1",
      role: "ADMIN",
    });

    const result = await onboardRestaurantAction({ name: "", ownerPhone: "nope" });

    expect(result.success).toBe(false);
    expect(result.fieldErrors).toBeDefined();
    expect(onboardRestaurant).not.toHaveBeenCalled();
  });

  it("onboards for a valid admin request", async () => {
    vi.mocked(getAdminContextOrNull).mockResolvedValue({
      userId: "adm_1",
      role: "ADMIN",
    });
    vi.mocked(onboardRestaurant).mockResolvedValue({
      id: "res_1",
      name: "Spice Route",
      slug: "spice-route",
      city: null,
      country: "IN",
      isActive: true,
      ownerName: "Asha",
      ownerPhone: "+919876543210",
      onboardedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await onboardRestaurantAction({
      name: "Spice Route",
      ownerPhone: "+919876543210",
    });

    expect(result.success).toBe(true);
    expect(onboardRestaurant).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Spice Route",
        ownerPhone: "+919876543210",
        country: "IN",
      }),
    );
  });
});
