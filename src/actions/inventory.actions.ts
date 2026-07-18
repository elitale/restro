"use server";

import { withManagerValidation } from "@/actions/helpers";
import {
  adjustStockSchema,
  bulkReceiveSchema,
  countStockSchema,
  createStockItemSchema,
  deleteStockItemSchema,
  updateStockItemSchema,
} from "@/lib/validators/inventory";
import {
  adjustStock,
  bulkReceive,
  countStock,
  createStockItem,
  deleteStockItem,
  updateStockItem,
} from "@/services/stock.service";

export const createStockItemAction = withManagerValidation(
  createStockItemSchema,
  (data, ctx) => createStockItem(ctx, data),
);

export const updateStockItemAction = withManagerValidation(
  updateStockItemSchema,
  (data, ctx) => updateStockItem(ctx, data),
);

export const deleteStockItemAction = withManagerValidation(
  deleteStockItemSchema,
  (data, ctx) => deleteStockItem(ctx, data),
);

export const adjustStockAction = withManagerValidation(
  adjustStockSchema,
  (data, ctx) => adjustStock(ctx, data),
);

export const bulkReceiveAction = withManagerValidation(
  bulkReceiveSchema,
  (data, ctx) => bulkReceive(ctx, data),
);

export const countStockAction = withManagerValidation(
  countStockSchema,
  (data, ctx) => countStock(ctx, data),
);
