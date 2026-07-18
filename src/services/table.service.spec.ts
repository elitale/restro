import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DiningTable } from "@/generated/prisma/client";

vi.mock("@/repositories/table.repository", () => ({
  createTable: vi.fn(),
  findTableById: vi.fn(),
  findTableByLabel: vi.fn(),
  findTablesByRestaurant: vi.fn(),
  maxTableSortOrder: vi.fn(),
  reviveTable: vi.fn(),
  softDeleteTable: vi.fn(),
  updateTable: vi.fn(),
}));

import {
  createTable as createTableRepo,
  findTableById,
  findTableByLabel,
  maxTableSortOrder,
  reviveTable,
  softDeleteTable,
  updateTable as updateTableRepo,
} from "@/repositories/table.repository";
import {
  createTable,
  deleteTable,
  resolveTableForOrder,
  TABLE_FORBIDDEN,
  TABLE_LABEL_TAKEN,
  updateTable,
} from "./table.service";

const ctx = { restaurantId: "res_1", userId: "u1" };

const makeTable = (o: Partial<DiningTable> = {}): DiningTable =>
  ({
    id: "t1",
    restaurantId: "res_1",
    label: "T1",
    seats: null,
    section: null,
    sortOrder: 3,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...o,
  }) as unknown as DiningTable;

describe("createTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(maxTableSortOrder).mockResolvedValue(4);
    vi.mocked(createTableRepo).mockResolvedValue(makeTable({ id: "new" }));
  });

  it("creates a new table with the next sort order", async () => {
    vi.mocked(findTableByLabel).mockResolvedValue(null);

    await createTable(ctx, { label: "T9", isActive: true });

    expect(createTableRepo).toHaveBeenCalledWith(
      "res_1",
      expect.objectContaining({ label: "T9", sortOrder: 5 }),
    );
  });

  it("rejects a label already in use by an active table", async () => {
    vi.mocked(findTableByLabel).mockResolvedValue(makeTable());

    await expect(
      createTable(ctx, { label: "T1", isActive: true }),
    ).rejects.toThrow(TABLE_LABEL_TAKEN);
    expect(createTableRepo).not.toHaveBeenCalled();
  });

  it("revives a soft-deleted table when its label is re-added", async () => {
    vi.mocked(findTableByLabel).mockResolvedValue(
      makeTable({ id: "old", deletedAt: new Date() }),
    );
    vi.mocked(reviveTable).mockResolvedValue(makeTable({ id: "old" }));

    await createTable(ctx, { label: "T1", isActive: true });

    expect(reviveTable).toHaveBeenCalledWith("old", expect.any(Object));
    expect(createTableRepo).not.toHaveBeenCalled();
  });
});

describe("updateTable / deleteTable / resolveTableForOrder", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects updating a table from another restaurant", async () => {
    vi.mocked(findTableById).mockResolvedValue(makeTable({ restaurantId: "x" }));

    await expect(
      updateTable(ctx, { id: "t1", label: "T2", isActive: true }),
    ).rejects.toThrow(TABLE_FORBIDDEN);
  });

  it("rejects renaming onto an active label owned by another table", async () => {
    vi.mocked(findTableById).mockResolvedValue(makeTable({ id: "t1", label: "T1" }));
    vi.mocked(findTableByLabel).mockResolvedValue(makeTable({ id: "t2", label: "T2" }));

    await expect(
      updateTable(ctx, { id: "t1", label: "T2", isActive: true }),
    ).rejects.toThrow(TABLE_LABEL_TAKEN);
    expect(updateTableRepo).not.toHaveBeenCalled();
  });

  it("soft-deletes an owned table", async () => {
    vi.mocked(findTableById).mockResolvedValue(makeTable());

    await deleteTable(ctx, { id: "t1" });

    expect(softDeleteTable).toHaveBeenCalledWith("t1");
  });

  it("resolveTableForOrder returns the authoritative label", async () => {
    vi.mocked(findTableById).mockResolvedValue(makeTable({ id: "t1", label: "T7" }));

    expect(await resolveTableForOrder("res_1", "t1")).toEqual({
      id: "t1",
      label: "T7",
    });
  });
});
