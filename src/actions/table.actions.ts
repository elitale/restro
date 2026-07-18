"use server";

import { withManagerValidation } from "@/actions/helpers";
import {
  createTableSchema,
  deleteTableSchema,
  updateTableSchema,
} from "@/lib/validators/table";
import {
  createTable,
  deleteTable,
  updateTable,
} from "@/services/table.service";

export const createTableAction = withManagerValidation(
  createTableSchema,
  (data, ctx) => createTable(ctx, data),
);

export const updateTableAction = withManagerValidation(
  updateTableSchema,
  (data, ctx) => updateTable(ctx, data),
);

export const deleteTableAction = withManagerValidation(
  deleteTableSchema,
  (data, ctx) => deleteTable(ctx, data),
);
