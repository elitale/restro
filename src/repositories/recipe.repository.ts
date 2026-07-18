import type { Prisma, RecipeComponent } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const RECIPE_INCLUDE = {
  stockItem: {
    select: { id: true, name: true, unit: true, restaurantId: true },
  },
} satisfies Prisma.RecipeComponentInclude;

export type RecipeComponentWithStock = Prisma.RecipeComponentGetPayload<{
  include: typeof RECIPE_INCLUDE;
}>;

export const findRecipeByMenuItem = (
  menuItemId: string,
): Promise<RecipeComponentWithStock[]> =>
  prisma.recipeComponent.findMany({
    where: { menuItemId },
    include: RECIPE_INCLUDE,
    orderBy: { createdAt: "asc" },
  });

export const findRecipesForMenuItems = (menuItemIds: string[]) =>
  prisma.recipeComponent.findMany({
    where: { menuItemId: { in: menuItemIds } },
    select: { menuItemId: true, stockItemId: true, quantity: true },
  });

export const findRecipesByRestaurant = (
  restaurantId: string,
): Promise<RecipeComponentWithStock[]> =>
  prisma.recipeComponent.findMany({
    where: { menuItem: { restaurantId } },
    include: RECIPE_INCLUDE,
    orderBy: { createdAt: "asc" },
  });

export const upsertRecipeComponent = (
  menuItemId: string,
  stockItemId: string,
  quantity: number,
): Promise<RecipeComponent> =>
  prisma.recipeComponent.upsert({
    where: { menuItemId_stockItemId: { menuItemId, stockItemId } },
    create: { menuItemId, stockItemId, quantity },
    update: { quantity },
  });

export const findRecipeComponentById = (id: string) =>
  prisma.recipeComponent.findUnique({
    where: { id },
    include: { menuItem: { select: { restaurantId: true } } },
  });

export const deleteRecipeComponent = (id: string): Promise<RecipeComponent> =>
  prisma.recipeComponent.delete({ where: { id } });
