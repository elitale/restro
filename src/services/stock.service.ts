import type { StockItem } from "@/generated/prisma/client";
import type {
  AdjustStockInput,
  BulkReceiveInput,
  CountStockInput,
  CreateStockItemInput,
  UpdateStockItemInput,
} from "@/lib/validators/inventory";
import {
  applyCounts,
  applyMovement,
  applyMovements,
  createStockItem as createStockItemRepo,
  findMovements,
  findStockItemById,
  findStockItemByName,
  findStockItemsByRestaurant,
  reviveStockItem,
  softDeleteStockItem,
  updateStockItem as updateStockItemRepo,
  type MovementInput,
  type StockItemWriteData,
} from "@/repositories/stock.repository";
import type {
  StockItemDTO,
  StockMovementDTO,
  StockUnit,
} from "@/types/inventory";

export const STOCK_NOT_FOUND = "STOCK_NOT_FOUND";
export const STOCK_FORBIDDEN = "STOCK_FORBIDDEN";
export const STOCK_NAME_TAKEN = "STOCK_NAME_TAKEN";

export interface StockContext {
  readonly restaurantId: string;
  readonly userId: string;
}

const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v != null ? Number(v) : null);

export const mapStock = (s: StockItem): StockItemDTO => {
  const onHand = num(s.onHand);
  const reorderLevel = numOrNull(s.reorderLevel);
  return {
    id: s.id,
    name: s.name,
    unit: s.unit as StockUnit,
    category: s.category,
    onHand,
    reorderLevel,
    parLevel: numOrNull(s.parLevel),
    costPerUnit: numOrNull(s.costPerUnit),
    supplier: s.supplier,
    notes: s.notes,
    isActive: s.isActive,
    isLow: reorderLevel != null && onHand <= reorderLevel,
  };
};

const toWriteData = (
  input: CreateStockItemInput | UpdateStockItemInput,
): StockItemWriteData => ({
  name: input.name,
  unit: input.unit,
  category: input.category ?? null,
  reorderLevel: input.reorderLevel ?? null,
  parLevel: input.parLevel ?? null,
  costPerUnit: input.costPerUnit ?? null,
  supplier: input.supplier ?? null,
  notes: input.notes ?? null,
  isActive: input.isActive,
});

export const listStock = async (
  restaurantId: string,
): Promise<StockItemDTO[]> =>
  (await findStockItemsByRestaurant(restaurantId, { includeInactive: true })).map(
    mapStock,
  );

export const getLowStockCount = async (
  restaurantId: string,
): Promise<number> =>
  (await findStockItemsByRestaurant(restaurantId))
    .map(mapStock)
    .filter((s) => s.isLow).length;

const loadOwnedItem = async (
  restaurantId: string,
  id: string,
): Promise<StockItem> => {
  const item = await findStockItemById(id);
  if (!item || item.deletedAt) {
    throw new Error(STOCK_NOT_FOUND);
  }
  if (item.restaurantId !== restaurantId) {
    throw new Error(STOCK_FORBIDDEN);
  }
  return item;
};

export const createStockItem = async (
  ctx: StockContext,
  input: CreateStockItemInput,
): Promise<StockItemDTO> => {
  const existing = await findStockItemByName(ctx.restaurantId, input.name);
  if (existing && !existing.deletedAt) {
    throw new Error(STOCK_NAME_TAKEN);
  }
  const data = toWriteData(input);
  if (existing) {
    return mapStock(await reviveStockItem(existing.id, data));
  }
  const item = await createStockItemRepo(ctx.restaurantId, data, 0);
  if (input.openingOnHand > 0) {
    await applyMovement({
      restaurantId: ctx.restaurantId,
      stockItemId: item.id,
      type: "CORRECTION",
      delta: input.openingOnHand,
      reason: "Opening stock",
      note: null,
      orderId: null,
      createdById: ctx.userId,
    });
    return mapStock((await findStockItemById(item.id)) ?? item);
  }
  return mapStock(item);
};

export const updateStockItem = async (
  ctx: StockContext,
  input: UpdateStockItemInput,
): Promise<StockItemDTO> => {
  const item = await loadOwnedItem(ctx.restaurantId, input.id);
  if (input.name !== item.name) {
    const clash = await findStockItemByName(ctx.restaurantId, input.name);
    if (clash && clash.id !== item.id && !clash.deletedAt) {
      throw new Error(STOCK_NAME_TAKEN);
    }
  }
  return mapStock(await updateStockItemRepo(item.id, toWriteData(input)));
};

export const deleteStockItem = async (
  ctx: StockContext,
  input: { id: string },
): Promise<void> => {
  const item = await loadOwnedItem(ctx.restaurantId, input.id);
  await softDeleteStockItem(item.id);
};

export const adjustStock = async (
  ctx: StockContext,
  input: AdjustStockInput,
): Promise<void> => {
  await loadOwnedItem(ctx.restaurantId, input.stockItemId);
  const delta = input.type === "RECEIVE" ? input.quantity : -input.quantity;
  await applyMovement({
    restaurantId: ctx.restaurantId,
    stockItemId: input.stockItemId,
    type: input.type,
    delta,
    reason: input.reason ?? null,
    note: input.note ?? null,
    orderId: null,
    createdById: ctx.userId,
  });
};

const ownedIdSet = async (restaurantId: string): Promise<Set<string>> =>
  new Set(
    (
      await findStockItemsByRestaurant(restaurantId, { includeInactive: true })
    ).map((s) => s.id),
  );

export const bulkReceive = async (
  ctx: StockContext,
  input: BulkReceiveInput,
): Promise<void> => {
  const owned = await ownedIdSet(ctx.restaurantId);
  const inputs: MovementInput[] = input.rows.map((row) => {
    if (!owned.has(row.stockItemId)) {
      throw new Error(STOCK_FORBIDDEN);
    }
    return {
      restaurantId: ctx.restaurantId,
      stockItemId: row.stockItemId,
      type: "RECEIVE",
      delta: row.quantity,
      reason: null,
      note: input.note ?? null,
      orderId: null,
      createdById: ctx.userId,
    };
  });
  await applyMovements(inputs);
};

export const countStock = async (
  ctx: StockContext,
  input: CountStockInput,
): Promise<void> => {
  const owned = await ownedIdSet(ctx.restaurantId);
  const inputs = input.rows.map((row) => {
    if (!owned.has(row.stockItemId)) {
      throw new Error(STOCK_FORBIDDEN);
    }
    return {
      restaurantId: ctx.restaurantId,
      stockItemId: row.stockItemId,
      countedOnHand: row.countedOnHand,
      note: input.note ?? null,
      createdById: ctx.userId,
    };
  });
  await applyCounts(inputs);
};

export const getStockItem = async (
  ctx: StockContext,
  id: string,
): Promise<StockItemDTO> => mapStock(await loadOwnedItem(ctx.restaurantId, id));

export const listMovements = async (
  ctx: StockContext,
  stockItemId: string,
): Promise<StockMovementDTO[]> => {
  await loadOwnedItem(ctx.restaurantId, stockItemId);
  return (await findMovements(stockItemId)).map((m) => ({
    id: m.id,
    type: m.type,
    quantity: num(m.quantity),
    resultingOnHand: num(m.resultingOnHand),
    reason: m.reason,
    note: m.note,
    createdAt: m.createdAt.toISOString(),
  }));
};
