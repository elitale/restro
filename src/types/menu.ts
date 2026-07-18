export type MenuTaxKind = "NONE" | "SERVICE" | "GOODS";

export interface MenuTaxDTO {
  readonly kind: MenuTaxKind;
  readonly rate: number;
  readonly code: string | null;
  readonly separatelyCharged: boolean;
  readonly inclusive: boolean;
}

export interface MenuVariantDTO {
  readonly id: string;
  readonly name: string;
  readonly price: number;
}

export interface MenuModifierDTO {
  readonly id: string;
  readonly name: string;
  readonly priceDelta: number;
}

export interface MenuModifierGroupDTO {
  readonly id: string;
  readonly name: string;
  readonly minSelect: number;
  readonly maxSelect: number;
  readonly isRequired: boolean;
  readonly modifiers: readonly MenuModifierDTO[];
}

export interface MenuItemImageDTO {
  readonly id: string;
  readonly url: string;
  readonly isPrimary: boolean;
}

export type DietaryType = "VEG" | "NON_VEG" | "EGG";
export type MenuItemType = "SERVED" | "PACKAGED_GOODS";

export interface MenuItemDTO {
  readonly id: string;
  readonly categoryId: string;
  readonly name: string;
  readonly shortDescription: string | null;
  readonly longDescription: string | null;
  readonly itemType: MenuItemType;
  readonly dietaryType: DietaryType | null;
  readonly price: number;
  readonly isActive: boolean;
  readonly available: boolean;
  readonly disabledReason: string | null;
  readonly resumeAt: string | null;
  readonly tax: MenuTaxDTO;
  readonly images: readonly MenuItemImageDTO[];
  readonly variants: readonly MenuVariantDTO[];
  readonly modifierGroups: readonly MenuModifierGroupDTO[];
}

export interface MenuCategoryDTO {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
}

export interface MenuDTO {
  readonly categories: readonly MenuCategoryDTO[];
  readonly items: readonly MenuItemDTO[];
}
