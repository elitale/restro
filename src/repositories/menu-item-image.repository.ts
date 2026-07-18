import type { MenuItemImage } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface MenuItemImageWriteData {
  menuItemId: string;
  url: string;
  storageKey: string;
  isPrimary?: boolean;
  sortOrder?: number;
}

export const createMenuItemImage = (
  data: MenuItemImageWriteData,
): Promise<MenuItemImage> =>
  prisma.menuItemImage.create({
    data: {
      menuItem: { connect: { id: data.menuItemId } },
      url: data.url,
      storageKey: data.storageKey,
      isPrimary: data.isPrimary ?? false,
      sortOrder: data.sortOrder ?? 0,
    },
  });

export const findMenuItemImageById = (
  id: string,
): Promise<MenuItemImage | null> =>
  prisma.menuItemImage.findUnique({ where: { id } });

export const listImagesForItem = (
  menuItemId: string,
): Promise<MenuItemImage[]> =>
  prisma.menuItemImage.findMany({
    where: { menuItemId },
    orderBy: { sortOrder: "asc" },
  });

export const countImagesForItem = (menuItemId: string): Promise<number> =>
  prisma.menuItemImage.count({ where: { menuItemId } });

export const deleteMenuItemImage = (id: string): Promise<MenuItemImage> =>
  prisma.menuItemImage.delete({ where: { id } });
