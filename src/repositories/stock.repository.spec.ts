import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  create,
  findUnique,
  findMany,
  update,
  moveFindMany,
  txItemUpdate,
  txItemFind,
  txMoveCreate,
  $transaction,
} = vi.hoisted(() => {
  const txItemUpdate = vi.fn();
  const txItemFind = vi.fn();
  const txMoveCreate = vi.fn();
  return {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    moveFindMany: vi.fn(),
    txItemUpdate,
    txItemFind,
    txMoveCreate,
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) =>
      cb({
        stockItem: { update: txItemUpdate, findUniqueOrThrow: txItemFind },
        stockMovement: { create: txMoveCreate },
      }),
    ),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    stockItem: { create, findUnique, findMany, update },
    stockMovement: { findMany: moveFindMany },
    $transaction,
  },
}));

import {
  applyCounts,
  applyMovement,
  createStockItem,
  findStockItemsByRestaurant,
  softDeleteStockItem,
  type StockItemWriteData,
} from "./stock.repository";

const data: StockItemWriteData = {
  name: "Paneer",
  unit: "KG",
  category: null,
  reorderLevel: 2,
  parLevel: null,
  costPerUnit: null,
  supplier: null,
  notes: null,
  isActive: true,
};

describe("stockRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createStockItem connects the restaurant and sets opening on-hand", async () => {
    create.mockResolvedValue({ id: "s1" });

    await createStockItem("res_1", data, 5);

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        restaurant: { connect: { id: "res_1" } },
        onHand: 5,
        name: "Paneer",
      }),
    });
  });

  it("findStockItemsByRestaurant returns active items grouped by category", async () => {
    findMany.mockResolvedValue([]);

    await findStockItemsByRestaurant("res_1");

    expect(findMany).toHaveBeenCalledWith({
      where: { restaurantId: "res_1", deletedAt: null, isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  });

  it("softDeleteStockItem marks it deleted and inactive", async () => {
    update.mockResolvedValue({});

    await softDeleteStockItem("s1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { deletedAt: expect.any(Date), isActive: false },
    });
  });

  it("applyMovement increments on-hand and records the movement", async () => {
    txItemUpdate.mockResolvedValue({ onHand: 15 });
    txMoveCreate.mockResolvedValue({ id: "m1" });

    await applyMovement({
      restaurantId: "res_1",
      stockItemId: "s1",
      type: "RECEIVE",
      delta: 10,
      reason: null,
      note: null,
      orderId: null,
      createdById: "u1",
    });

    expect(txItemUpdate).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { onHand: { increment: 10 } },
      select: { onHand: true },
    });
    expect(txMoveCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "RECEIVE",
        quantity: 10,
        resultingOnHand: 15,
      }),
    });
  });

  it("applyCounts records the signed correction delta and sets on-hand", async () => {
    txItemFind.mockResolvedValue({ onHand: 8 });
    txItemUpdate.mockResolvedValue({ onHand: 12 });
    txMoveCreate.mockResolvedValue({ id: "m2" });

    await applyCounts([
      {
        restaurantId: "res_1",
        stockItemId: "s1",
        countedOnHand: 12,
        note: null,
        createdById: "u1",
      },
    ]);

    expect(txItemUpdate).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { onHand: 12 },
      select: { onHand: true },
    });
    expect(txMoveCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "CORRECTION",
        quantity: 4,
        resultingOnHand: 12,
      }),
    });
  });
});
