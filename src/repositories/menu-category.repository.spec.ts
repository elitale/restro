import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, findUnique, findMany, update } = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { menuCategory: { create, findUnique, findMany, update } },
}));

import {
  createMenuCategory,
  findCategoriesByRestaurant,
  softDeleteMenuCategory,
} from "./menu-category.repository";

describe("menuCategoryRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createMenuCategory connects the restaurant and applies defaults", async () => {
    create.mockResolvedValue({ id: "c1" });

    await createMenuCategory("res_1", { name: "Starters" });

    expect(create).toHaveBeenCalledWith({
      data: {
        restaurant: { connect: { id: "res_1" } },
        name: "Starters",
        description: null,
        sortOrder: 0,
        isActive: true,
      },
    });
  });

  it("findCategoriesByRestaurant excludes soft-deleted", async () => {
    findMany.mockResolvedValue([]);

    await findCategoriesByRestaurant("res_1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { restaurantId: "res_1", deletedAt: null },
      }),
    );
  });

  it("softDeleteMenuCategory sets deletedAt", async () => {
    update.mockResolvedValue({});

    await softDeleteMenuCategory("c1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c1" },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });
});
