import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, findUnique, findMany, findFirst, update } = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    diningTable: { create, findUnique, findMany, findFirst, update },
  },
}));

import {
  createTable,
  findTablesByRestaurant,
  maxTableSortOrder,
  softDeleteTable,
} from "./table.repository";

describe("tableRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createTable connects the restaurant and applies defaults", async () => {
    create.mockResolvedValue({ id: "t1" });

    await createTable("res_1", { label: "T1" });

    expect(create).toHaveBeenCalledWith({
      data: {
        restaurant: { connect: { id: "res_1" } },
        label: "T1",
        seats: null,
        section: null,
        sortOrder: 0,
        isActive: true,
      },
    });
  });

  it("findTablesByRestaurant returns active tables only by default, grouped", async () => {
    findMany.mockResolvedValue([]);

    await findTablesByRestaurant("res_1");

    expect(findMany).toHaveBeenCalledWith({
      where: { restaurantId: "res_1", deletedAt: null, isActive: true },
      orderBy: [{ section: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    });
  });

  it("findTablesByRestaurant can include inactive for the manager view", async () => {
    findMany.mockResolvedValue([]);

    await findTablesByRestaurant("res_1", { includeInactive: true });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { restaurantId: "res_1", deletedAt: null },
      }),
    );
  });

  it("softDeleteTable marks it deleted and inactive", async () => {
    update.mockResolvedValue({});

    await softDeleteTable("t1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { deletedAt: expect.any(Date), isActive: false },
    });
  });

  it("maxTableSortOrder returns 0 when there are no tables", async () => {
    findFirst.mockResolvedValue(null);

    expect(await maxTableSortOrder("res_1")).toBe(0);
  });
});
