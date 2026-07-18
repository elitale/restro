import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StockItem } from "@/generated/prisma/client";

vi.mock("@/repositories/stock.repository", () => ({
  applyCounts: vi.fn(),
  applyMovement: vi.fn(),
  applyMovements: vi.fn(),
  createStockItem: vi.fn(),
  findMovements: vi.fn(),
  findStockItemById: vi.fn(),
  findStockItemByName: vi.fn(),
  findStockItemsByRestaurant: vi.fn(),
  reviveStockItem: vi.fn(),
  softDeleteStockItem: vi.fn(),
  updateStockItem: vi.fn(),
}));

import {
  applyCounts,
  applyMovement,
  applyMovements,
  createStockItem as createStockItemRepo,
  findStockItemById,
  findStockItemByName,
  findStockItemsByRestaurant,
  reviveStockItem,
} from "@/repositories/stock.repository";
import {
  adjustStock,
  bulkReceive,
  countStock,
  createStockItem,
  getLowStockCount,
  mapStock,
  STOCK_FORBIDDEN,
  STOCK_NAME_TAKEN,
} from "./stock.service";

const ctx = { restaurantId: "res_1", userId: "u1" };

const makeItem = (o: Record<string, unknown> = {}): StockItem =>
  ({
    id: "s1",
    restaurantId: "res_1",
    name: "Paneer",
    unit: "KG",
    category: null,
    onHand: 5,
    reorderLevel: null,
    parLevel: null,
    costPerUnit: null,
    supplier: null,
    notes: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...o,
  }) as unknown as StockItem;

describe("mapStock", () => {
  it("flags low stock when on-hand is at/under reorder level", () => {
    expect(mapStock(makeItem({ onHand: 2, reorderLevel: 2 })).isLow).toBe(true);
    expect(mapStock(makeItem({ onHand: 3, reorderLevel: 2 })).isLow).toBe(false);
    expect(mapStock(makeItem({ reorderLevel: null })).isLow).toBe(false);
  });
});

describe("createStockItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createStockItemRepo).mockResolvedValue(makeItem({ id: "new" }));
  });

  it("records an opening-stock movement when opening on-hand > 0", async () => {
    vi.mocked(findStockItemByName).mockResolvedValue(null);
    vi.mocked(findStockItemById).mockResolvedValue(makeItem({ id: "new", onHand: 8 }));

    await createStockItem(ctx, {
      name: "Oil",
      unit: "LITRE",
      openingOnHand: 8,
      cuisines: [],
      isActive: true,
    } as never);

    expect(applyMovement).toHaveBeenCalledWith(
      expect.objectContaining({ type: "CORRECTION", delta: 8, reason: "Opening stock" }),
    );
  });

  it("rejects a duplicate active name", async () => {
    vi.mocked(findStockItemByName).mockResolvedValue(makeItem());

    await expect(
      createStockItem(ctx, {
        name: "Paneer",
        unit: "KG",
        openingOnHand: 0,
        isActive: true,
      } as never),
    ).rejects.toThrow(STOCK_NAME_TAKEN);
  });

  it("revives a soft-deleted item when its name is re-added", async () => {
    vi.mocked(findStockItemByName).mockResolvedValue(
      makeItem({ id: "old", deletedAt: new Date() }),
    );
    vi.mocked(reviveStockItem).mockResolvedValue(makeItem({ id: "old" }));

    await createStockItem(ctx, {
      name: "Paneer",
      unit: "KG",
      openingOnHand: 0,
      isActive: true,
    } as never);

    expect(reviveStockItem).toHaveBeenCalled();
    expect(createStockItemRepo).not.toHaveBeenCalled();
  });
});

describe("adjust / bulk / count", () => {
  beforeEach(() => vi.clearAllMocks());

  it("wasting applies a negative delta", async () => {
    vi.mocked(findStockItemById).mockResolvedValue(makeItem());

    await adjustStock(ctx, {
      stockItemId: "s1",
      type: "WASTE",
      quantity: 3,
      reason: "Spoiled",
    });

    expect(applyMovement).toHaveBeenCalledWith(
      expect.objectContaining({ type: "WASTE", delta: -3 }),
    );
  });

  it("bulkReceive rejects a row from another restaurant", async () => {
    vi.mocked(findStockItemsByRestaurant).mockResolvedValue([makeItem({ id: "s1" })]);

    await expect(
      bulkReceive(ctx, { rows: [{ stockItemId: "other", quantity: 5 }] }),
    ).rejects.toThrow(STOCK_FORBIDDEN);
    expect(applyMovements).not.toHaveBeenCalled();
  });

  it("countStock forwards counted values for owned items", async () => {
    vi.mocked(findStockItemsByRestaurant).mockResolvedValue([makeItem({ id: "s1" })]);

    await countStock(ctx, { rows: [{ stockItemId: "s1", countedOnHand: 12 }] });

    expect(applyCounts).toHaveBeenCalledWith([
      expect.objectContaining({ stockItemId: "s1", countedOnHand: 12 }),
    ]);
  });

  it("getLowStockCount counts only low active items", async () => {
    vi.mocked(findStockItemsByRestaurant).mockResolvedValue([
      makeItem({ id: "a", onHand: 1, reorderLevel: 2 }),
      makeItem({ id: "b", onHand: 9, reorderLevel: 2 }),
    ]);

    expect(await getLowStockCount("res_1")).toBe(1);
  });
});
