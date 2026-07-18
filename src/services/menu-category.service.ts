import type {
  CreateMenuCategoryInput,
  UpdateMenuCategoryInput,
} from "@/lib/validators/menu";
import {
  createMenuCategory,
  findMenuCategoryById,
  softDeleteMenuCategory,
  updateMenuCategory,
} from "@/repositories/menu-category.repository";
import { countActiveItemsInCategory } from "@/repositories/menu-item.repository";

export const MENU_CATEGORY_NOT_FOUND = "MENU_CATEGORY_NOT_FOUND";
export const MENU_FORBIDDEN = "MENU_FORBIDDEN";
export const CATEGORY_NOT_EMPTY = "CATEGORY_NOT_EMPTY";

const assertOwned = async (
  restaurantId: string,
  id: string,
): Promise<void> => {
  const category = await findMenuCategoryById(id);
  if (!category || category.deletedAt) {
    throw new Error(MENU_CATEGORY_NOT_FOUND);
  }
  if (category.restaurantId !== restaurantId) {
    throw new Error(MENU_FORBIDDEN);
  }
};

export const createCategory = async (
  restaurantId: string,
  input: CreateMenuCategoryInput,
): Promise<void> => {
  await createMenuCategory(restaurantId, input);
};

export const updateCategory = async (
  restaurantId: string,
  input: UpdateMenuCategoryInput,
): Promise<void> => {
  await assertOwned(restaurantId, input.id);
  await updateMenuCategory(input.id, input);
};

export const deleteCategory = async (
  restaurantId: string,
  id: string,
): Promise<void> => {
  await assertOwned(restaurantId, id);
  if ((await countActiveItemsInCategory(id)) > 0) {
    throw new Error(CATEGORY_NOT_EMPTY);
  }
  await softDeleteMenuCategory(id);
};
