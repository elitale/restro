import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({ getAdminContextOrNull: vi.fn() }));
vi.mock("@/lib/manager-auth", () => ({ getManagerContextOrNull: vi.fn() }));
vi.mock("@/services/restaurant-settings.service", () => ({
  updateTaxProfile: vi.fn(),
}));

import { getManagerContextOrNull } from "@/lib/manager-auth";
import { updateTaxProfile } from "@/services/restaurant-settings.service";
import { updateTaxProfileAction } from "./settings.actions";

describe("updateTaxProfileAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getManagerContextOrNull).mockResolvedValue({
      userId: "u1",
      restaurantId: "res_1",
    });
  });

  it("delegates with the manager's restaurant", async () => {
    const result = await updateTaxProfileAction({
      gstRegistrationType: "REGULAR",
      serviceGstRate: 5,
      pricesTaxInclusive: false,
    });

    expect(result.success).toBe(true);
    expect(updateTaxProfile).toHaveBeenCalledWith(
      "res_1",
      expect.objectContaining({ gstRegistrationType: "REGULAR" }),
    );
  });

  it("rejects an invalid profile (regular without a rate)", async () => {
    const result = await updateTaxProfileAction({
      gstRegistrationType: "REGULAR",
    });

    expect(result.success).toBe(false);
    expect(updateTaxProfile).not.toHaveBeenCalled();
  });

  it("returns NO_RESTAURANT without a restaurant", async () => {
    vi.mocked(getManagerContextOrNull).mockResolvedValue(null);

    const result = await updateTaxProfileAction({
      gstRegistrationType: "UNREGISTERED",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("NO_RESTAURANT");
  });
});
