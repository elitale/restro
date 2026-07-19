"use server";

import { withManagerValidation } from "@/actions/helpers";
import {
  addItemsSchema,
  createOrderSchema,
  fireOrderSchema,
  serveLineSchema,
  settleSchema,
  settleTableSchema,
  voidLineSchema,
  voidOrderSchema,
} from "@/lib/validators/order";
import {
  addItems,
  createOrder,
  fireOrder,
  serveLine,
  voidLine,
  voidWholeOrder,
} from "@/services/order.service";
import { settle, settleTable } from "@/services/settlement.service";

export const createOrderAction = withManagerValidation(
  createOrderSchema,
  (data, ctx) => createOrder(ctx, data),
);

export const addItemsAction = withManagerValidation(addItemsSchema, (data, ctx) =>
  addItems(ctx, data),
);

export const fireOrderAction = withManagerValidation(
  fireOrderSchema,
  (data, ctx) => fireOrder(ctx, data.orderId),
);

export const serveLineAction = withManagerValidation(
  serveLineSchema,
  (data, ctx) => serveLine(ctx, data),
);

export const voidLineAction = withManagerValidation(voidLineSchema, (data, ctx) =>
  voidLine(ctx, data),
);

export const voidOrderAction = withManagerValidation(
  voidOrderSchema,
  (data, ctx) => voidWholeOrder(ctx, data),
);

export const settleOrderAction = withManagerValidation(settleSchema, (data, ctx) =>
  settle(ctx, data),
);

export const settleTableAction = withManagerValidation(
  settleTableSchema,
  (data, ctx) => settleTable(ctx, data),
);
