import type { DiningTable } from "@/generated/prisma/client";
import type { CreateTableInput, UpdateTableInput } from "@/lib/validators/table";
import {
  createTable as createTableRepo,
  findTableById,
  findTableByLabel,
  findTablesByRestaurant,
  maxTableSortOrder,
  reviveTable,
  softDeleteTable,
  updateTable as updateTableRepo,
} from "@/repositories/table.repository";
import type { TableDTO } from "@/types/table";

export const TABLE_NOT_FOUND = "TABLE_NOT_FOUND";
export const TABLE_FORBIDDEN = "TABLE_FORBIDDEN";
export const TABLE_LABEL_TAKEN = "TABLE_LABEL_TAKEN";

export interface TableContext {
  readonly restaurantId: string;
  readonly userId: string;
}

const mapTable = (t: DiningTable): TableDTO => ({
  id: t.id,
  label: t.label,
  seats: t.seats,
  section: t.section,
  isActive: t.isActive,
});

export const getTables = async (restaurantId: string): Promise<TableDTO[]> =>
  (await findTablesByRestaurant(restaurantId)).map(mapTable);

export const listTablesForManager = async (
  restaurantId: string,
): Promise<TableDTO[]> =>
  (await findTablesByRestaurant(restaurantId, { includeInactive: true })).map(
    mapTable,
  );

const loadOwnedTable = async (
  restaurantId: string,
  id: string,
): Promise<DiningTable> => {
  const table = await findTableById(id);
  if (!table || table.deletedAt) {
    throw new Error(TABLE_NOT_FOUND);
  }
  if (table.restaurantId !== restaurantId) {
    throw new Error(TABLE_FORBIDDEN);
  }
  return table;
};

export const createTable = async (
  ctx: TableContext,
  input: CreateTableInput,
): Promise<TableDTO> => {
  const existing = await findTableByLabel(ctx.restaurantId, input.label);
  if (existing && !existing.deletedAt) {
    throw new Error(TABLE_LABEL_TAKEN);
  }
  const sortOrder = (await maxTableSortOrder(ctx.restaurantId)) + 1;
  const data = {
    label: input.label,
    seats: input.seats ?? null,
    section: input.section ?? null,
    sortOrder,
    isActive: input.isActive,
  };
  // Re-adding a previously removed label revives the soft-deleted row.
  if (existing) {
    return mapTable(await reviveTable(existing.id, data));
  }
  return mapTable(await createTableRepo(ctx.restaurantId, data));
};

export const updateTable = async (
  ctx: TableContext,
  input: UpdateTableInput,
): Promise<TableDTO> => {
  const table = await loadOwnedTable(ctx.restaurantId, input.id);
  if (input.label !== table.label) {
    const clash = await findTableByLabel(ctx.restaurantId, input.label);
    if (clash && clash.id !== table.id && !clash.deletedAt) {
      throw new Error(TABLE_LABEL_TAKEN);
    }
  }
  return mapTable(
    await updateTableRepo(table.id, {
      label: input.label,
      seats: input.seats ?? null,
      section: input.section ?? null,
      sortOrder: table.sortOrder,
      isActive: input.isActive,
    }),
  );
};

export const deleteTable = async (
  ctx: TableContext,
  input: { id: string },
): Promise<void> => {
  const table = await loadOwnedTable(ctx.restaurantId, input.id);
  await softDeleteTable(table.id);
};

/** Verify a table belongs to the restaurant and return its authoritative label. */
export const resolveTableForOrder = async (
  restaurantId: string,
  tableId: string,
): Promise<{ id: string; label: string }> => {
  const table = await loadOwnedTable(restaurantId, tableId);
  return { id: table.id, label: table.label };
};
