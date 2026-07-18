import type { DiningTable } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface TableWriteData {
  label: string;
  seats?: number | null;
  section?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export const createTable = (
  restaurantId: string,
  data: TableWriteData,
): Promise<DiningTable> =>
  prisma.diningTable.create({
    data: {
      restaurant: { connect: { id: restaurantId } },
      label: data.label,
      seats: data.seats ?? null,
      section: data.section ?? null,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
    },
  });

export const findTableById = (id: string): Promise<DiningTable | null> =>
  prisma.diningTable.findUnique({ where: { id } });

export const findTableByLabel = (
  restaurantId: string,
  label: string,
): Promise<DiningTable | null> =>
  prisma.diningTable.findUnique({
    where: { restaurantId_label: { restaurantId, label } },
  });

export const findTablesByRestaurant = (
  restaurantId: string,
  opts: { includeInactive?: boolean } = {},
): Promise<DiningTable[]> =>
  prisma.diningTable.findMany({
    where: {
      restaurantId,
      deletedAt: null,
      ...(opts.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ section: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
  });

export const updateTable = (
  id: string,
  data: TableWriteData,
): Promise<DiningTable> =>
  prisma.diningTable.update({
    where: { id },
    data: {
      label: data.label,
      seats: data.seats ?? null,
      section: data.section ?? null,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    },
  });

/** Restore a soft-deleted table under its label (re-adding a removed label). */
export const reviveTable = (
  id: string,
  data: TableWriteData,
): Promise<DiningTable> =>
  prisma.diningTable.update({
    where: { id },
    data: {
      deletedAt: null,
      label: data.label,
      seats: data.seats ?? null,
      section: data.section ?? null,
      sortOrder: data.sortOrder,
      isActive: data.isActive ?? true,
    },
  });

export const softDeleteTable = (id: string): Promise<DiningTable> =>
  prisma.diningTable.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

export const maxTableSortOrder = async (
  restaurantId: string,
): Promise<number> => {
  const top = await prisma.diningTable.findFirst({
    where: { restaurantId, deletedAt: null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return top?.sortOrder ?? 0;
};
