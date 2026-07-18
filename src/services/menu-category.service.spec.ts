import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MenuCategory } from "@/generated/prisma/client";

vi.mock("@/repositories/menu-category.repository", () => ({
  createMenuCategory: vi.fn(),
  findMenuCategoryById: vi.fn(),
  softDeleteMenuCategory: vi.fn(),
  updateMenuCategory: vi.fn(),
}));
vi.mock("@/repositories/menu-item.repository", () => ({
  countActiveItemsInCategory: vi.fn(),
}));

import {
  findMenuCategoryById,
  softDeleteMenuCategory,
  updateMenuCategory,
} from "@/repositories/menu-category.repository";
import { countActiveItemsInCategory } from "@/repositories/menu-item.repository";
import {
  CATEGORY_NOT_EMPTY,
  deleteCategory,
  MENU_FORBIDDEN,
  updateCategory,
} from "./menu-category.service";

const makeCategory = (
  overrides: Partial<MenuCategory> = {},
): MenuCategory => ({
  id: "cat_1",
  restaurantId: "res_1",
  name: "Starters",
  description: null,
  sortOrder: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

describe("updateCategory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates a category owned by the restaurant", async () => {
    vi.mocked(findMenuCategoryById).mockResolvedValue(makeCategory());

    await updateCategory("res_1", {
      id: "cat_1",
      name: "Mains",
      sortOrder: 0,
      isActive: true,
    });

    expect(updateMenuCategory).toHaveBeenCalledWith(
      "cat_1",
      expect.objectContaining({ name: "Mains" }),
    );
  });

  it("rejects a category owned by another restaurant", async () => {
    vi.mocked(findMenuCategoryById).mockResolvedValue(
      makeCategory({ restaurantId: "other" }),
    );

    await expect(
      updateCategory("res_1", {
        id: "cat_1",
        name: "x",
        sortOrder: 0,
        isActive: true,
      }),
    ).rejects.toThrow(MENU_FORBIDDEN);
  });
});

describe("deleteCategory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("soft-deletes an empty category", async () => {
    vi.mocked(findMenuCategoryById).mockResolvedValue(makeCategory());
    vi.mocked(countActiveItemsInCategory).mockResolvedValue(0);

    await deleteCategory("res_1", "cat_1");

    expect(softDeleteMenuCategory).toHaveBeenCalledWith("cat_1");
  });

  it("refuses to delete a category that still has items", async () => {
    vi.mocked(findMenuCategoryById).mockResolvedValue(makeCategory());
    vi.mocked(countActiveItemsInCategory).mockResolvedValue(3);

    await expect(deleteCategory("res_1", "cat_1")).rejects.toThrow(
      CATEGORY_NOT_EMPTY,
    );
    expect(softDeleteMenuCategory).not.toHaveBeenCalled();
  });
});
