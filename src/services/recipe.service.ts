import type {
  SetRecipeComponentInput,
  RemoveRecipeComponentInput,
} from "@/lib/validators/inventory";
import { findMenuItemOwnership } from "@/repositories/menu-item.repository";
import {
  deleteRecipeComponent,
  findRecipeByMenuItem,
  findRecipeComponentById,
  findRecipesByRestaurant,
  findRecipesForMenuItems,
  upsertRecipeComponent,
} from "@/repositories/recipe.repository";
import { findStockItemById } from "@/repositories/stock.repository";
import type { RecipeComponentDTO, StockUnit } from "@/types/inventory";

export const RECIPE_MENU_ITEM_NOT_FOUND = "RECIPE_MENU_ITEM_NOT_FOUND";
export const RECIPE_FORBIDDEN = "RECIPE_FORBIDDEN";
export const RECIPE_STOCK_NOT_FOUND = "RECIPE_STOCK_NOT_FOUND";

export interface RecipeContext {
  readonly restaurantId: string;
  readonly userId: string;
}

const assertMenuItemOwned = async (
  restaurantId: string,
  menuItemId: string,
): Promise<void> => {
  const owner = await findMenuItemOwnership(menuItemId);
  if (!owner) {
    throw new Error(RECIPE_MENU_ITEM_NOT_FOUND);
  }
  if (owner.restaurantId !== restaurantId) {
    throw new Error(RECIPE_FORBIDDEN);
  }
};

export const getRecipe = async (
  ctx: RecipeContext,
  menuItemId: string,
): Promise<RecipeComponentDTO[]> => {
  await assertMenuItemOwned(ctx.restaurantId, menuItemId);
  return (await findRecipeByMenuItem(menuItemId)).map((c) => ({
    id: c.id,
    stockItemId: c.stockItemId,
    stockItemName: c.stockItem.name,
    unit: c.stockItem.unit as StockUnit,
    quantity: Number(c.quantity),
  }));
};

/** All recipes for a restaurant, grouped by menu item (for the menu page). */
export const listRecipes = async (
  restaurantId: string,
): Promise<Record<string, RecipeComponentDTO[]>> => {
  const rows = await findRecipesByRestaurant(restaurantId);
  const grouped: Record<string, RecipeComponentDTO[]> = {};
  for (const c of rows) {
    (grouped[c.menuItemId] ??= []).push({
      id: c.id,
      stockItemId: c.stockItemId,
      stockItemName: c.stockItem.name,
      unit: c.stockItem.unit as StockUnit,
      quantity: Number(c.quantity),
    });
  }
  return grouped;
};

export const setRecipeComponent = async (
  ctx: RecipeContext,
  input: SetRecipeComponentInput,
): Promise<void> => {
  await assertMenuItemOwned(ctx.restaurantId, input.menuItemId);
  const stock = await findStockItemById(input.stockItemId);
  if (!stock || stock.deletedAt || stock.restaurantId !== ctx.restaurantId) {
    throw new Error(RECIPE_STOCK_NOT_FOUND);
  }
  await upsertRecipeComponent(input.menuItemId, input.stockItemId, input.quantity);
};

export const removeRecipeComponent = async (
  ctx: RecipeContext,
  input: RemoveRecipeComponentInput,
): Promise<void> => {
  const component = await findRecipeComponentById(input.id);
  if (!component) {
    return;
  }
  if (component.menuItem.restaurantId !== ctx.restaurantId) {
    throw new Error(RECIPE_FORBIDDEN);
  }
  await deleteRecipeComponent(input.id);
};

export interface RecipeLine {
  readonly stockItemId: string;
  readonly quantity: number;
}

/** menuItemId → its recipe lines, for depletion. */
export const getRecipesMap = async (
  menuItemIds: string[],
): Promise<Map<string, RecipeLine[]>> => {
  const rows = await findRecipesForMenuItems([...new Set(menuItemIds)]);
  const map = new Map<string, RecipeLine[]>();
  for (const row of rows) {
    const lines = map.get(row.menuItemId) ?? [];
    lines.push({ stockItemId: row.stockItemId, quantity: Number(row.quantity) });
    map.set(row.menuItemId, lines);
  }
  return map;
};
