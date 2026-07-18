"use server";

import { withManagerValidation } from "@/actions/helpers";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import {
  createMenuCategorySchema,
  createMenuItemSchema,
  createModifierGroupSchema,
  deleteMenuItemImageSchema,
  disableItemSchema,
  idOnlySchema,
  reenableItemSchema,
  updateMenuCategorySchema,
  updateMenuItemSchema,
  updateModifierGroupSchema,
} from "@/lib/validators/menu";
import { disableItem, reenableItem } from "@/services/menu-availability.service";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/services/menu-category.service";
import {
  addItemImageForRestaurant,
  removeItemImageForRestaurant,
} from "@/services/menu-image.service";
import { createItem, deleteItem, updateItem } from "@/services/menu-item.service";
import { createGroup, deleteGroup, updateGroup } from "@/services/modifier.service";
import { failure, success, type ActionResult } from "@/types";

// ------------------------------------------------------------- categories ---

export const createCategoryAction = withManagerValidation(
  createMenuCategorySchema,
  (data, ctx) => createCategory(ctx.restaurantId, data),
);

export const updateCategoryAction = withManagerValidation(
  updateMenuCategorySchema,
  (data, ctx) => updateCategory(ctx.restaurantId, data),
);

export const deleteCategoryAction = withManagerValidation(
  idOnlySchema,
  (data, ctx) => deleteCategory(ctx.restaurantId, data.id),
);

// ------------------------------------------------------------------ items ---

export const createItemAction = withManagerValidation(
  createMenuItemSchema,
  (data, ctx) => createItem(ctx.restaurantId, data),
);

export const updateItemAction = withManagerValidation(
  updateMenuItemSchema,
  (data, ctx) => updateItem(ctx.restaurantId, data),
);

export const deleteItemAction = withManagerValidation(
  idOnlySchema,
  (data, ctx) => deleteItem(ctx.restaurantId, data.id),
);

// -------------------------------------------------------- modifier groups ---

export const createGroupAction = withManagerValidation(
  createModifierGroupSchema,
  (data, ctx) => createGroup(ctx.restaurantId, data),
);

export const updateGroupAction = withManagerValidation(
  updateModifierGroupSchema,
  (data, ctx) => updateGroup(ctx.restaurantId, data),
);

export const deleteGroupAction = withManagerValidation(
  idOnlySchema,
  (data, ctx) => deleteGroup(ctx.restaurantId, data.id),
);

// ----------------------------------------------------------- availability ---

export const disableItemAction = withManagerValidation(
  disableItemSchema,
  (data, ctx) => disableItem(ctx.restaurantId, ctx.userId, data),
);

export const reenableItemAction = withManagerValidation(
  reenableItemSchema,
  (data, ctx) => reenableItem(ctx.restaurantId, ctx.userId, data.itemId),
);

// ----------------------------------------------------------------- images ---

export const deleteItemImageAction = withManagerValidation(
  deleteMenuItemImageSchema,
  (data, ctx) => removeItemImageForRestaurant(ctx.restaurantId, data.imageId),
);

export const uploadItemImageAction = async (
  formData: FormData,
): Promise<ActionResult<{ id: string; url: string }>> => {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return failure("NO_RESTAURANT");
  }

  const itemId = formData.get("itemId");
  const file = formData.get("file");
  if (typeof itemId !== "string" || !(file instanceof File)) {
    return failure("Invalid upload");
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const image = await addItemImageForRestaurant(ctx.restaurantId, itemId, {
      buffer,
      type: file.type,
      size: file.size,
    });
    return success({ id: image.id, url: image.url });
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Upload failed");
  }
};
