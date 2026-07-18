import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/repositories/menu-item.repository", () => ({
  findMenuItemOwnership: vi.fn(),
}));
vi.mock("@/repositories/recipe.repository", () => ({
  deleteRecipeComponent: vi.fn(),
  findRecipeByMenuItem: vi.fn(),
  findRecipeComponentById: vi.fn(),
  findRecipesForMenuItems: vi.fn(),
  upsertRecipeComponent: vi.fn(),
}));
vi.mock("@/repositories/stock.repository", () => ({
  findStockItemById: vi.fn(),
}));

import { findMenuItemOwnership } from "@/repositories/menu-item.repository";
import {
  deleteRecipeComponent,
  findRecipeComponentById,
  findRecipesForMenuItems,
  upsertRecipeComponent,
} from "@/repositories/recipe.repository";
import { findStockItemById } from "@/repositories/stock.repository";
import {
  getRecipesMap,
  RECIPE_FORBIDDEN,
  RECIPE_STOCK_NOT_FOUND,
  removeRecipeComponent,
  setRecipeComponent,
} from "./recipe.service";

const ctx = { restaurantId: "res_1", userId: "u1" };

describe("recipe service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("setRecipeComponent upserts when the item + stock are owned", async () => {
    vi.mocked(findMenuItemOwnership).mockResolvedValue({ restaurantId: "res_1" } as never);
    vi.mocked(findStockItemById).mockResolvedValue({
      id: "s1",
      restaurantId: "res_1",
      deletedAt: null,
    } as never);

    await setRecipeComponent(ctx, {
      menuItemId: "m1",
      stockItemId: "s1",
      quantity: 0.2,
    });

    expect(upsertRecipeComponent).toHaveBeenCalledWith("m1", "s1", 0.2);
  });

  it("setRecipeComponent rejects a stock item from another restaurant", async () => {
    vi.mocked(findMenuItemOwnership).mockResolvedValue({ restaurantId: "res_1" } as never);
    vi.mocked(findStockItemById).mockResolvedValue({
      id: "s1",
      restaurantId: "other",
      deletedAt: null,
    } as never);

    await expect(
      setRecipeComponent(ctx, { menuItemId: "m1", stockItemId: "s1", quantity: 1 }),
    ).rejects.toThrow(RECIPE_STOCK_NOT_FOUND);
    expect(upsertRecipeComponent).not.toHaveBeenCalled();
  });

  it("removeRecipeComponent rejects a component from another restaurant", async () => {
    vi.mocked(findRecipeComponentById).mockResolvedValue({
      id: "rc1",
      menuItem: { restaurantId: "other" },
    } as never);

    await expect(removeRecipeComponent(ctx, { id: "rc1" })).rejects.toThrow(
      RECIPE_FORBIDDEN,
    );
    expect(deleteRecipeComponent).not.toHaveBeenCalled();
  });

  it("getRecipesMap groups lines by menu item", async () => {
    vi.mocked(findRecipesForMenuItems).mockResolvedValue([
      { menuItemId: "m1", stockItemId: "s1", quantity: 0.2 },
      { menuItemId: "m1", stockItemId: "s2", quantity: 1 },
      { menuItemId: "m2", stockItemId: "s1", quantity: 0.5 },
    ] as never);

    const map = await getRecipesMap(["m1", "m2", "m1"]);

    expect(map.get("m1")).toEqual([
      { stockItemId: "s1", quantity: 0.2 },
      { stockItemId: "s2", quantity: 1 },
    ]);
    expect(map.get("m2")).toEqual([{ stockItemId: "s1", quantity: 0.5 }]);
  });
});
