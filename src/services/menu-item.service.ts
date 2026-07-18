import type {
  GstRegistrationType,
  MenuItemType as PrismaMenuItemType,
} from "@/generated/prisma/client";
import type {
  CreateMenuItemInput,
  UpdateMenuItemInput,
} from "@/lib/validators/menu";
import {
  findCategoriesByRestaurant,
  findMenuCategoryById,
} from "@/repositories/menu-category.repository";
import {
  createMenuItem,
  findMenuItemOwnership,
  findMenuItemsByRestaurant,
  softDeleteMenuItem,
  updateMenuItem,
  type MenuItemWithRelations,
  type MenuItemWriteData,
} from "@/repositories/menu-item.repository";
import { findModifierGroupOwnership } from "@/repositories/modifier-group.repository";
import { findRestaurantById } from "@/repositories/restaurant.repository";
import type { MenuDTO, MenuItemDTO, MenuTaxDTO } from "@/types/menu";

export const MENU_ITEM_NOT_FOUND = "MENU_ITEM_NOT_FOUND";
export const MENU_CATEGORY_NOT_FOUND = "MENU_CATEGORY_NOT_FOUND";
export const MENU_MODIFIER_GROUP_NOT_FOUND = "MENU_MODIFIER_GROUP_NOT_FOUND";
export const MENU_FORBIDDEN = "MENU_FORBIDDEN";
export const RESTAURANT_NOT_FOUND = "RESTAURANT_NOT_FOUND";

// ------------------------------------------------------- pure domain logic ---

interface TaxableItem {
  readonly itemType: PrismaMenuItemType;
  readonly goodsGstRate: number | null;
  readonly hsnSacCode: string | null;
  readonly priceTaxInclusive: boolean | null;
}

interface TaxProfile {
  readonly gstRegistrationType: GstRegistrationType;
  readonly serviceGstRate: number | null;
  readonly pricesTaxInclusive: boolean;
  readonly sacCode: string | null;
}

/**
 * Resolve the GST that applies to an item. Served food uses the outlet-level
 * service rate; packaged goods use their own rate; unregistered = no GST;
 * composition = a rate that is not separately charged (tax-inclusive price).
 */
export const resolveItemTax = (
  item: TaxableItem,
  restaurant: TaxProfile,
): MenuTaxDTO => {
  const inclusiveDefault = item.priceTaxInclusive ?? restaurant.pricesTaxInclusive;

  if (restaurant.gstRegistrationType === "UNREGISTERED") {
    return {
      kind: "NONE",
      rate: 0,
      code: null,
      separatelyCharged: false,
      inclusive: inclusiveDefault,
    };
  }

  const separatelyCharged = restaurant.gstRegistrationType === "REGULAR";
  const inclusive =
    restaurant.gstRegistrationType === "COMPOSITION" ? true : inclusiveDefault;

  if (item.itemType === "PACKAGED_GOODS" && item.goodsGstRate != null) {
    return {
      kind: "GOODS",
      rate: item.goodsGstRate,
      code: item.hsnSacCode ?? null,
      separatelyCharged,
      inclusive,
    };
  }

  return {
    kind: "SERVICE",
    rate: restaurant.serviceGstRate ?? 0,
    code: item.hsnSacCode ?? restaurant.sacCode ?? null,
    separatelyCharged,
    inclusive,
  };
};

interface AvailabilityItem {
  readonly isActive: boolean;
  readonly deletedAt: Date | null;
  readonly category: { readonly isActive: boolean; readonly deletedAt: Date | null };
  readonly disables: readonly {
    readonly reenabledAt: Date | null;
    readonly resumeAt: Date | null;
  }[];
}

/** An item is available unless it's inactive, its category is off, or it has a live 86. */
export const isItemAvailable = (item: AvailabilityItem, now: Date): boolean => {
  if (!item.isActive || item.deletedAt) {
    return false;
  }
  if (!item.category.isActive || item.category.deletedAt) {
    return false;
  }
  const liveDisable = item.disables.find(
    (d) => d.reenabledAt === null && (d.resumeAt === null || d.resumeAt > now),
  );
  return liveDisable === undefined;
};

// ----------------------------------------------------------------- mapping ---

const num = (value: unknown): number => Number(value);

const mapItem = (
  item: MenuItemWithRelations,
  restaurant: TaxProfile,
  now: Date,
): MenuItemDTO => {
  const liveDisable = item.disables.find(
    (d) => d.resumeAt === null || d.resumeAt > now,
  );

  return {
    id: item.id,
    categoryId: item.categoryId,
    name: item.name,
    shortDescription: item.shortDescription,
    longDescription: item.longDescription,
    itemType: item.itemType,
    dietaryType: item.dietaryType,
    price: num(item.price),
    isActive: item.isActive,
    available: isItemAvailable(item, now),
    disabledReason: liveDisable?.reason ?? null,
    resumeAt: liveDisable?.resumeAt ? liveDisable.resumeAt.toISOString() : null,
    tax: resolveItemTax(
      {
        itemType: item.itemType,
        goodsGstRate: item.goodsGstRate != null ? num(item.goodsGstRate) : null,
        hsnSacCode: item.hsnSacCode,
        priceTaxInclusive: item.priceTaxInclusive,
      },
      restaurant,
    ),
    images: item.images.map((im) => ({
      id: im.id,
      url: im.url,
      isPrimary: im.isPrimary,
    })),
    variants: item.variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: num(v.price),
    })),
    modifierGroups: item.modifierGroups.map((link) => ({
      id: link.modifierGroup.id,
      name: link.modifierGroup.name,
      minSelect: link.modifierGroup.minSelect,
      maxSelect: link.modifierGroup.maxSelect,
      isRequired: link.modifierGroup.isRequired,
      modifiers: link.modifierGroup.modifiers.map((m) => ({
        id: m.id,
        name: m.name,
        priceDelta: num(m.priceDelta),
      })),
    })),
  };
};

// ------------------------------------------------------------ ownership ---

const assertCategoryOwned = async (
  restaurantId: string,
  categoryId: string,
): Promise<void> => {
  const category = await findMenuCategoryById(categoryId);
  if (!category || category.deletedAt) {
    throw new Error(MENU_CATEGORY_NOT_FOUND);
  }
  if (category.restaurantId !== restaurantId) {
    throw new Error(MENU_FORBIDDEN);
  }
};

const assertGroupsOwned = async (
  restaurantId: string,
  groupIds: readonly string[],
): Promise<void> => {
  for (const id of groupIds) {
    const owner = await findModifierGroupOwnership(id);
    if (!owner) {
      throw new Error(MENU_MODIFIER_GROUP_NOT_FOUND);
    }
    if (owner.restaurantId !== restaurantId) {
      throw new Error(MENU_FORBIDDEN);
    }
  }
};

const assertItemOwned = async (
  restaurantId: string,
  itemId: string,
): Promise<void> => {
  const owner = await findMenuItemOwnership(itemId);
  if (!owner) {
    throw new Error(MENU_ITEM_NOT_FOUND);
  }
  if (owner.restaurantId !== restaurantId) {
    throw new Error(MENU_FORBIDDEN);
  }
};

const toWriteData = (
  input: CreateMenuItemInput | UpdateMenuItemInput,
): MenuItemWriteData => ({
  categoryId: input.categoryId,
  name: input.name,
  shortDescription: input.shortDescription ?? null,
  longDescription: input.longDescription ?? null,
  itemType: input.itemType,
  dietaryType: input.dietaryType ?? null,
  price: input.price,
  priceTaxInclusive: input.priceTaxInclusive ?? null,
  goodsGstRate: input.goodsGstRate ?? null,
  hsnSacCode: input.hsnSacCode ?? null,
  sortOrder: input.sortOrder,
  isActive: input.isActive,
  variants: input.variants.map((v) => ({
    name: v.name,
    price: v.price,
    sortOrder: v.sortOrder,
    isActive: v.isActive,
  })),
  modifierGroupIds: input.modifierGroupIds,
});

// -------------------------------------------------------------- use cases ---

const taxProfile = (r: {
  gstRegistrationType: GstRegistrationType;
  serviceGstRate: unknown;
  pricesTaxInclusive: boolean;
  sacCode: string | null;
}): TaxProfile => ({
  gstRegistrationType: r.gstRegistrationType,
  serviceGstRate: r.serviceGstRate != null ? num(r.serviceGstRate) : null,
  pricesTaxInclusive: r.pricesTaxInclusive,
  sacCode: r.sacCode,
});

/** The full menu (categories + items with resolved tax + computed availability). */
export const getMenu = async (restaurantId: string): Promise<MenuDTO> => {
  const restaurant = await findRestaurantById(restaurantId);
  if (!restaurant || restaurant.deletedAt) {
    throw new Error(RESTAURANT_NOT_FOUND);
  }
  const profile = taxProfile(restaurant);
  const now = new Date();
  const [categories, items] = await Promise.all([
    findCategoriesByRestaurant(restaurantId),
    findMenuItemsByRestaurant(restaurantId),
  ]);

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
    })),
    items: items.map((i) => mapItem(i, profile, now)),
  };
};

export const createItem = async (
  restaurantId: string,
  input: CreateMenuItemInput,
): Promise<void> => {
  await assertCategoryOwned(restaurantId, input.categoryId);
  await assertGroupsOwned(restaurantId, input.modifierGroupIds);
  await createMenuItem(restaurantId, toWriteData(input));
};

export const updateItem = async (
  restaurantId: string,
  input: UpdateMenuItemInput,
): Promise<void> => {
  await assertItemOwned(restaurantId, input.id);
  await assertCategoryOwned(restaurantId, input.categoryId);
  await assertGroupsOwned(restaurantId, input.modifierGroupIds);
  await updateMenuItem(input.id, toWriteData(input));
};

export const deleteItem = async (
  restaurantId: string,
  itemId: string,
): Promise<void> => {
  await assertItemOwned(restaurantId, itemId);
  await softDeleteMenuItem(itemId);
};

export { assertItemOwned };
