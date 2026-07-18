import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, findUnique, findMany, count, deleteFn } = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  deleteFn: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    menuItemImage: { create, findUnique, findMany, count, delete: deleteFn },
  },
}));

import {
  countImagesForItem,
  createMenuItemImage,
  deleteMenuItemImage,
} from "./menu-item-image.repository";

describe("menuItemImageRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createMenuItemImage connects the item and defaults", async () => {
    create.mockResolvedValue({ id: "img1" });

    await createMenuItemImage({ menuItemId: "i1", url: "u", storageKey: "k" });

    expect(create).toHaveBeenCalledWith({
      data: {
        menuItem: { connect: { id: "i1" } },
        url: "u",
        storageKey: "k",
        isPrimary: false,
        sortOrder: 0,
      },
    });
  });

  it("countImagesForItem counts by item", async () => {
    count.mockResolvedValue(2);
    await expect(countImagesForItem("i1")).resolves.toBe(2);
    expect(count).toHaveBeenCalledWith({ where: { menuItemId: "i1" } });
  });

  it("deleteMenuItemImage deletes by id", async () => {
    deleteFn.mockResolvedValue({});
    await deleteMenuItemImage("img1");
    expect(deleteFn).toHaveBeenCalledWith({ where: { id: "img1" } });
  });
});
