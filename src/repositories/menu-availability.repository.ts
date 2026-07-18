import type { MenuItemAvailability } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface CreateDisableData {
  menuItemId: string;
  reason: "OUT_OF_STOCK" | "QUALITY" | "PREP_TIME" | "OTHER";
  note?: string | null;
  disabledById: string;
  resumeAt?: Date | null;
}

export const createDisable = (
  data: CreateDisableData,
): Promise<MenuItemAvailability> =>
  prisma.menuItemAvailability.create({
    data: {
      menuItem: { connect: { id: data.menuItemId } },
      reason: data.reason,
      note: data.note ?? null,
      disabledById: data.disabledById,
      resumeAt: data.resumeAt ?? null,
    },
  });

/** Latest not-yet-re-enabled 86 for an item (may still be expired by resumeAt). */
export const findOpenDisable = (
  menuItemId: string,
): Promise<MenuItemAvailability | null> =>
  prisma.menuItemAvailability.findFirst({
    where: { menuItemId, reenabledAt: null },
    orderBy: { disabledAt: "desc" },
  });

export const closeDisable = (
  id: string,
  reenabledById: string,
): Promise<MenuItemAvailability> =>
  prisma.menuItemAvailability.update({
    where: { id },
    data: { reenabledAt: new Date(), reenabledById },
  });

/** All open 86s across a restaurant's live items — for the "86 board". */
export const findOpenDisablesByRestaurant = (
  restaurantId: string,
): Promise<MenuItemAvailability[]> =>
  prisma.menuItemAvailability.findMany({
    where: { reenabledAt: null, menuItem: { restaurantId, deletedAt: null } },
    orderBy: { disabledAt: "desc" },
  });
