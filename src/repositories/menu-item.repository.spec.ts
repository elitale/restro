import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, findUnique, findMany, update } = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { menuItem: { create, findUnique, findMany, update } },
}));

import {
  createMenuItem,
  findMenuItemsByRestaurant,
  updateMenuItem,
} from "./menu-item.repository";

const writeData = {
  categoryId: "cat_1",
  name: "Biryani",
  itemType: "SERVED" as const,
  price: 250,
  variants: [
    { name: "Half", price: 150 },
    { name: "Full", price: 250 },
  ],
  modifierGroupIds: ["g1", "g2"],
};

describe("menuItemRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createMenuItem nests variants and modifier-group links with order", async () => {
    create.mockResolvedValue({ id: "i1" });

    await createMenuItem("res_1", writeData);

    const arg = create.mock.calls[0][0];
    expect(arg.data.restaurant).toEqual({ connect: { id: "res_1" } });
    expect(arg.data.category).toEqual({ connect: { id: "cat_1" } });
    expect(arg.data.variants.create).toHaveLength(2);
    expect(arg.data.variants.create[0]).toMatchObject({
      name: "Half",
      price: 150,
      sortOrder: 0,
    });
    expect(arg.data.modifierGroups.create).toEqual([
      { modifierGroupId: "g1", sortOrder: 0 },
      { modifierGroupId: "g2", sortOrder: 1 },
    ]);
    expect(arg.include).toBeDefined();
  });

  it("updateMenuItem replaces variants and group links wholesale", async () => {
    update.mockResolvedValue({ id: "i1" });

    await updateMenuItem("i1", {
      ...writeData,
      variants: [],
      modifierGroupIds: [],
    });

    const arg = update.mock.calls[0][0];
    expect(arg.data.variants).toEqual({ deleteMany: {}, create: [] });
    expect(arg.data.modifierGroups).toEqual({ deleteMany: {}, create: [] });
  });

  it("findMenuItemsByRestaurant excludes soft-deleted and includes relations", async () => {
    findMany.mockResolvedValue([]);

    await findMenuItemsByRestaurant("res_1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { restaurantId: "res_1", deletedAt: null },
        include: expect.any(Object),
      }),
    );
  });
});
