import type { MenuItem, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Everything the menu UI needs for one item in a single query. */
export const MENU_ITEM_INCLUDE = {
  category: true,
  images: { orderBy: { sortOrder: "asc" } },
  variants: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
  modifierGroups: {
    orderBy: { sortOrder: "asc" },
    include: {
      modifierGroup: {
        include: { modifiers: { orderBy: { sortOrder: "asc" } } },
      },
    },
  },
  // Open 86s only (not yet re-enabled); the service decides if resumeAt expired.
  disables: { where: { reenabledAt: null }, orderBy: { disabledAt: "desc" } },
} satisfies Prisma.MenuItemInclude;

export type MenuItemWithRelations = Prisma.MenuItemGetPayload<{
  include: typeof MENU_ITEM_INCLUDE;
}>;

export interface MenuItemVariantWriteData {
  name: string;
  price: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface MenuItemWriteData {
  categoryId: string;
  name: string;
  shortDescription?: string | null;
  longDescription?: string | null;
  itemType: "SERVED" | "PACKAGED_GOODS";
  dietaryType?: "VEG" | "NON_VEG" | "EGG" | null;
  price: number;
  priceTaxInclusive?: boolean | null;
  goodsGstRate?: number | null;
  hsnSacCode?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  variants: MenuItemVariantWriteData[];
  modifierGroupIds: string[];
}

const variantCreate = (variants: MenuItemVariantWriteData[]) =>
  variants.map((v, i) => ({
    name: v.name,
    price: v.price,
    sortOrder: v.sortOrder ?? i,
    isActive: v.isActive ?? true,
  }));

const groupCreate = (ids: string[]) =>
  ids.map((modifierGroupId, i) => ({ modifierGroupId, sortOrder: i }));

export const createMenuItem = (
  restaurantId: string,
  data: MenuItemWriteData,
): Promise<MenuItemWithRelations> =>
  prisma.menuItem.create({
    data: {
      restaurant: { connect: { id: restaurantId } },
      category: { connect: { id: data.categoryId } },
      name: data.name,
      shortDescription: data.shortDescription ?? null,
      longDescription: data.longDescription ?? null,
      itemType: data.itemType,
      dietaryType: data.dietaryType ?? null,
      price: data.price,
      priceTaxInclusive: data.priceTaxInclusive ?? null,
      goodsGstRate: data.goodsGstRate ?? null,
      hsnSacCode: data.hsnSacCode ?? null,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
      variants: { create: variantCreate(data.variants) },
      modifierGroups: { create: groupCreate(data.modifierGroupIds) },
    },
    include: MENU_ITEM_INCLUDE,
  });

export const findMenuItemById = (
  id: string,
): Promise<MenuItemWithRelations | null> =>
  prisma.menuItem.findUnique({ where: { id }, include: MENU_ITEM_INCLUDE });

export const findMenuItemsByRestaurant = (
  restaurantId: string,
): Promise<MenuItemWithRelations[]> =>
  prisma.menuItem.findMany({
    where: { restaurantId, deletedAt: null },
    include: MENU_ITEM_INCLUDE,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

export const updateMenuItem = (
  id: string,
  data: MenuItemWriteData,
): Promise<MenuItemWithRelations> =>
  prisma.menuItem.update({
    where: { id },
    data: {
      category: { connect: { id: data.categoryId } },
      name: data.name,
      shortDescription: data.shortDescription ?? null,
      longDescription: data.longDescription ?? null,
      itemType: data.itemType,
      dietaryType: data.dietaryType ?? null,
      price: data.price,
      priceTaxInclusive: data.priceTaxInclusive ?? null,
      goodsGstRate: data.goodsGstRate ?? null,
      hsnSacCode: data.hsnSacCode ?? null,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
      // v1: replace variants + group links wholesale (nothing references them yet).
      variants: { deleteMany: {}, create: variantCreate(data.variants) },
      modifierGroups: {
        deleteMany: {},
        create: groupCreate(data.modifierGroupIds),
      },
    },
    include: MENU_ITEM_INCLUDE,
  });

export const softDeleteMenuItem = (id: string): Promise<MenuItem> =>
  prisma.menuItem.update({ where: { id }, data: { deletedAt: new Date() } });

export const findMenuItemOwnership = (
  id: string,
): Promise<{ restaurantId: string } | null> =>
  prisma.menuItem.findUnique({
    where: { id },
    select: { restaurantId: true },
  });

export const countActiveItemsInCategory = (
  categoryId: string,
): Promise<number> =>
  prisma.menuItem.count({ where: { categoryId, deletedAt: null } });
