import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({ getAdminContextOrNull: vi.fn() }));
vi.mock("@/lib/manager-auth", () => ({ getManagerContextOrNull: vi.fn() }));
vi.mock("@/services/menu-category.service", () => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));
vi.mock("@/services/menu-item.service", () => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}));
vi.mock("@/services/modifier.service", () => ({
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
}));
vi.mock("@/services/menu-availability.service", () => ({
  disableItem: vi.fn(),
  reenableItem: vi.fn(),
}));
vi.mock("@/services/menu-image.service", () => ({
  addItemImageForRestaurant: vi.fn(),
  removeItemImageForRestaurant: vi.fn(),
}));

import { getManagerContextOrNull } from "@/lib/manager-auth";
import { disableItem } from "@/services/menu-availability.service";
import { createCategory } from "@/services/menu-category.service";
import { addItemImageForRestaurant } from "@/services/menu-image.service";
import { createItem } from "@/services/menu-item.service";
import {
  createCategoryAction,
  createItemAction,
  disableItemAction,
  uploadItemImageAction,
} from "./menu.actions";

const CTX = { userId: "u1", restaurantId: "res_1" };

describe("menu actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getManagerContextOrNull).mockResolvedValue(CTX);
  });

  it("createCategoryAction delegates with the manager's restaurant", async () => {
    const result = await createCategoryAction({ name: "Starters" });

    expect(result.success).toBe(true);
    expect(createCategory).toHaveBeenCalledWith(
      "res_1",
      expect.objectContaining({ name: "Starters" }),
    );
  });

  it("createItemAction delegates the validated item", async () => {
    const result = await createItemAction({
      categoryId: "cat_1",
      name: "Paneer Tikka",
      price: 250,
    });

    expect(result.success).toBe(true);
    expect(createItem).toHaveBeenCalledWith(
      "res_1",
      expect.objectContaining({ categoryId: "cat_1", name: "Paneer Tikka" }),
    );
  });

  it("createItemAction rejects an invalid item with field errors", async () => {
    const result = await createItemAction({ name: "no category or price" });

    expect(result.success).toBe(false);
    expect(result.fieldErrors).toBeDefined();
    expect(createItem).not.toHaveBeenCalled();
  });

  it("disableItemAction passes the acting user and restaurant", async () => {
    const result = await disableItemAction({
      itemId: "i1",
      reason: "OUT_OF_STOCK",
    });

    expect(result.success).toBe(true);
    expect(disableItem).toHaveBeenCalledWith("res_1", "u1", {
      itemId: "i1",
      reason: "OUT_OF_STOCK",
    });
  });

  it("returns NO_RESTAURANT when the manager has no restaurant", async () => {
    vi.mocked(getManagerContextOrNull).mockResolvedValue(null);

    const result = await createCategoryAction({ name: "Starters" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("NO_RESTAURANT");
    expect(createCategory).not.toHaveBeenCalled();
  });

  it("uploadItemImageAction uploads a valid file", async () => {
    vi.mocked(addItemImageForRestaurant).mockResolvedValue({
      id: "img_1",
      menuItemId: "i1",
      url: "https://cdn/x.webp",
      storageKey: "menu-items/i1/x.webp",
      isPrimary: true,
      sortOrder: 0,
      createdAt: new Date(),
    });

    const form = new FormData();
    form.set("itemId", "i1");
    form.set("file", new File([Buffer.from("x")], "a.jpg", { type: "image/jpeg" }));

    const result = await uploadItemImageAction(form);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: "img_1", url: "https://cdn/x.webp" });
    expect(addItemImageForRestaurant).toHaveBeenCalledWith(
      "res_1",
      "i1",
      expect.objectContaining({ type: "image/jpeg" }),
    );
  });

  it("uploadItemImageAction rejects a missing file", async () => {
    const form = new FormData();
    form.set("itemId", "i1");

    const result = await uploadItemImageAction(form);

    expect(result.success).toBe(false);
    expect(addItemImageForRestaurant).not.toHaveBeenCalled();
  });
});
