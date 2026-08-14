import type { MobileTokenPayload } from "@/lib/mobile-session";
import { getMenu } from "@/services/menu-item.service";
import type { DietaryType, MenuItemType } from "@/types/menu";

import { MOBILE_ORDER_NO_RESTAURANT } from "./mobile-orders.service";

export interface MobileMenuCategoryDto {
  readonly id: string;
  readonly name: string;
  readonly sortOrder: number;
}

export interface MobileMenuItemImageDto {
  readonly id: string;
  readonly url: string;
  readonly isPrimary: boolean;
}

export interface MobileMenuVariantDto {
  readonly id: string;
  readonly name: string;
  readonly priceRupees: number;
}

export interface MobileMenuModifierDto {
  readonly id: string;
  readonly name: string;
  readonly priceDeltaRupees: number;
}

export interface MobileMenuModifierGroupDto {
  readonly id: string;
  readonly name: string;
  readonly minSelect: number;
  readonly maxSelect: number;
  readonly isRequired: boolean;
  readonly modifiers: readonly MobileMenuModifierDto[];
}

export interface MobileMenuItemDto {
  readonly id: string;
  readonly categoryId: string;
  readonly name: string;
  readonly shortDescription: string | null;
  readonly priceRupees: number;
  readonly dietaryType: DietaryType | null;
  readonly itemType: MenuItemType;
  readonly isAvailable: boolean;
  readonly primaryImageUrl: string | null;
  readonly images: readonly MobileMenuItemImageDto[];
  readonly variants: readonly MobileMenuVariantDto[];
  readonly modifierGroups: readonly MobileMenuModifierGroupDto[];
}

export interface MobileMenuResponse {
  readonly categories: readonly MobileMenuCategoryDto[];
  readonly items: readonly MobileMenuItemDto[];
}

export const listMobileMenu = async (
  auth: MobileTokenPayload,
): Promise<MobileMenuResponse> => {
  if (!auth.restaurantId) throw new Error(MOBILE_ORDER_NO_RESTAURANT);
  const menu = await getMenu(auth.restaurantId);

  const availableItems = menu.items.filter((i) => i.available);
  const usedCategoryIds = new Set(availableItems.map((i) => i.categoryId));

  const categories = menu.categories
    .filter((c) => c.isActive && usedCategoryIds.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
    }));

  const items: MobileMenuItemDto[] = availableItems.map((i) => {
    const primary = i.images.find((img) => img.isPrimary) ?? i.images[0];
    return {
      id: i.id,
      categoryId: i.categoryId,
      name: i.name,
      shortDescription: i.shortDescription,
      priceRupees: i.price,
      dietaryType: i.dietaryType,
      itemType: i.itemType,
      isAvailable: i.available,
      primaryImageUrl: primary?.url ?? null,
      images: i.images.map((img) => ({
        id: img.id,
        url: img.url,
        isPrimary: img.isPrimary,
      })),
      variants: i.variants.map((v) => ({
        id: v.id,
        name: v.name,
        priceRupees: v.price,
      })),
      modifierGroups: i.modifierGroups.map((g) => ({
        id: g.id,
        name: g.name,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        isRequired: g.isRequired,
        modifiers: g.modifiers.map((m) => ({
          id: m.id,
          name: m.name,
          priceDeltaRupees: m.priceDelta,
        })),
      })),
    };
  });

  return { categories, items };
};
