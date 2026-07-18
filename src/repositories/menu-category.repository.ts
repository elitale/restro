import type { MenuCategory } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface MenuCategoryWriteData {
  name: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export const createMenuCategory = (
  restaurantId: string,
  data: MenuCategoryWriteData,
): Promise<MenuCategory> =>
  prisma.menuCategory.create({
    data: {
      restaurant: { connect: { id: restaurantId } },
      name: data.name,
      description: data.description ?? null,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
    },
  });

export const findMenuCategoryById = (
  id: string,
): Promise<MenuCategory | null> =>
  prisma.menuCategory.findUnique({ where: { id } });

export const findCategoriesByRestaurant = (
  restaurantId: string,
): Promise<MenuCategory[]> =>
  prisma.menuCategory.findMany({
    where: { restaurantId, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

export const updateMenuCategory = (
  id: string,
  data: MenuCategoryWriteData,
): Promise<MenuCategory> =>
  prisma.menuCategory.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description ?? null,
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    },
  });

export const softDeleteMenuCategory = (id: string): Promise<MenuCategory> =>
  prisma.menuCategory.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
