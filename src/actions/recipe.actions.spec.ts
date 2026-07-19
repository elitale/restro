import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({ getAdminContextOrNull: vi.fn() }));
vi.mock("@/lib/manager-auth", () => ({ getManagerContextOrNull: vi.fn() }));
vi.mock("@/lib/staff-auth", () => ({ getStaffContextOrNull: vi.fn() }));
vi.mock("@/services/recipe.service", () => ({
  setRecipeComponent: vi.fn(),
  removeRecipeComponent: vi.fn(),
}));

import { getManagerContextOrNull } from "@/lib/manager-auth";
import { setRecipeComponent } from "@/services/recipe.service";
import {
  removeRecipeComponentAction,
  setRecipeComponentAction,
} from "./recipe.actions";

const CTX = { userId: "u1", restaurantId: "res_1" };

describe("recipe actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getManagerContextOrNull).mockResolvedValue(CTX);
  });

  it("setRecipeComponentAction delegates with the manager context", async () => {
    const result = await setRecipeComponentAction({
      menuItemId: "m1",
      stockItemId: "s1",
      quantity: 0.2,
    });

    expect(result.success).toBe(true);
    expect(setRecipeComponent).toHaveBeenCalledWith(
      CTX,
      expect.objectContaining({ menuItemId: "m1", stockItemId: "s1" }),
    );
  });

  it("setRecipeComponentAction rejects a non-positive quantity", async () => {
    const result = await setRecipeComponentAction({
      menuItemId: "m1",
      stockItemId: "s1",
      quantity: 0,
    });

    expect(result.success).toBe(false);
    expect(setRecipeComponent).not.toHaveBeenCalled();
  });

  it("returns NO_RESTAURANT without a restaurant", async () => {
    vi.mocked(getManagerContextOrNull).mockResolvedValue(null);

    const result = await removeRecipeComponentAction({ id: "rc1" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("NO_RESTAURANT");
  });
});
