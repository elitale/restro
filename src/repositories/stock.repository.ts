import type {
  Prisma,
  StockItem,
  StockMovement,
  StockMovementType,
  StockUnit,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface StockItemWriteData {
  name: string;
  unit: StockUnit;
  category: string | null;
  reorderLevel: number | null;
  parLevel: number | null;
  costPerUnit: number | null;
  supplier: string | null;
  notes: string | null;
  isActive: boolean;
}

export const createStockItem = (
  restaurantId: string,
  data: StockItemWriteData,
  openingOnHand: number,
): Promise<StockItem> =>
  prisma.stockItem.create({
    data: {
      restaurant: { connect: { id: restaurantId } },
      onHand: openingOnHand,
      ...data,
    },
  });

export const updateStockItem = (
  id: string,
  data: StockItemWriteData,
): Promise<StockItem> =>
  prisma.stockItem.update({ where: { id }, data });

export const reviveStockItem = (
  id: string,
  data: StockItemWriteData,
): Promise<StockItem> =>
  prisma.stockItem.update({
    where: { id },
    data: { ...data, deletedAt: null },
  });

export const softDeleteStockItem = (id: string): Promise<StockItem> =>
  prisma.stockItem.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

export const findStockItemById = (id: string): Promise<StockItem | null> =>
  prisma.stockItem.findUnique({ where: { id } });

export const findStockItemByName = (
  restaurantId: string,
  name: string,
): Promise<StockItem | null> =>
  prisma.stockItem.findUnique({
    where: { restaurantId_name: { restaurantId, name } },
  });

export const findStockItemsByRestaurant = (
  restaurantId: string,
  opts: { includeInactive?: boolean } = {},
): Promise<StockItem[]> =>
  prisma.stockItem.findMany({
    where: {
      restaurantId,
      deletedAt: null,
      ...(opts.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

export const findMovements = (
  stockItemId: string,
  limit = 50,
): Promise<StockMovement[]> =>
  prisma.stockMovement.findMany({
    where: { stockItemId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

export interface MovementInput {
  restaurantId: string;
  stockItemId: string;
  type: StockMovementType;
  delta: number;
  reason: string | null;
  note: string | null;
  orderId: string | null;
  createdById: string | null;
}

const writeMovement = (
  tx: Prisma.TransactionClient,
  input: MovementInput,
  resultingOnHand: Prisma.Decimal,
) =>
  tx.stockMovement.create({
    data: {
      restaurantId: input.restaurantId,
      stockItemId: input.stockItemId,
      type: input.type,
      quantity: input.delta,
      resultingOnHand,
      reason: input.reason,
      note: input.note,
      orderId: input.orderId,
      createdById: input.createdById,
    },
  });

/** Atomically increment on-hand by a signed delta + record the movement. */
export const applyMovement = (input: MovementInput): Promise<StockMovement> =>
  prisma.$transaction(async (tx) => {
    const item = await tx.stockItem.update({
      where: { id: input.stockItemId },
      data: { onHand: { increment: input.delta } },
      select: { onHand: true },
    });
    return writeMovement(tx, input, item.onHand);
  });

/** Apply many signed-delta movements in one transaction (bulk receive / depletion). */
export const applyMovements = (inputs: MovementInput[]): Promise<void> =>
  prisma.$transaction(async (tx) => {
    for (const input of inputs) {
      const item = await tx.stockItem.update({
        where: { id: input.stockItemId },
        data: { onHand: { increment: input.delta } },
        select: { onHand: true },
      });
      await writeMovement(tx, input, item.onHand);
    }
  });

export interface CountInput {
  restaurantId: string;
  stockItemId: string;
  countedOnHand: number;
  note: string | null;
  createdById: string;
}

const countInTx = async (
  tx: Prisma.TransactionClient,
  input: CountInput,
): Promise<void> => {
  const before = await tx.stockItem.findUniqueOrThrow({
    where: { id: input.stockItemId },
    select: { onHand: true },
  });
  const delta = input.countedOnHand - Number(before.onHand);
  const item = await tx.stockItem.update({
    where: { id: input.stockItemId },
    data: { onHand: input.countedOnHand },
    select: { onHand: true },
  });
  await writeMovement(
    tx,
    {
      restaurantId: input.restaurantId,
      stockItemId: input.stockItemId,
      type: "CORRECTION",
      delta,
      reason: "Physical count",
      note: input.note,
      orderId: null,
      createdById: input.createdById,
    },
    item.onHand,
  );
};

/** Set on-hand for many items to counted values in one transaction. */
export const applyCounts = (inputs: CountInput[]): Promise<void> =>
  prisma.$transaction(async (tx) => {
    for (const input of inputs) {
      await countInTx(tx, input);
    }
  });
