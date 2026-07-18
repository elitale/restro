import { randomUUID } from "node:crypto";

import sharp from "sharp";

import { deleteObject, publicUrl, putObject } from "@/lib/storage";
import type { MenuItemImage } from "@/generated/prisma/client";
import { findMenuItemOwnership } from "@/repositories/menu-item.repository";
import {
  countImagesForItem,
  createMenuItemImage,
  deleteMenuItemImage,
  findMenuItemImageById,
} from "@/repositories/menu-item-image.repository";

export const IMAGE_TYPE_INVALID = "IMAGE_TYPE_INVALID";
export const IMAGE_TOO_LARGE = "IMAGE_TOO_LARGE";
export const IMAGE_LIMIT_REACHED = "IMAGE_LIMIT_REACHED";
export const IMAGE_NOT_FOUND = "IMAGE_NOT_FOUND";
export const MENU_ITEM_NOT_FOUND = "MENU_ITEM_NOT_FOUND";
export const MENU_FORBIDDEN = "MENU_FORBIDDEN";

const MAX_IMAGES_PER_ITEM = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 1600;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface UploadFile {
  readonly buffer: Buffer;
  readonly type: string;
  readonly size: number;
}

/** Validate, optimise (WebP, capped size), upload, and record an item image. */
export const addItemImage = async (
  menuItemId: string,
  file: UploadFile,
): Promise<MenuItemImage> => {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(IMAGE_TYPE_INVALID);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(IMAGE_TOO_LARGE);
  }

  const existing = await countImagesForItem(menuItemId);
  if (existing >= MAX_IMAGES_PER_ITEM) {
    throw new Error(IMAGE_LIMIT_REACHED);
  }

  const optimised = await sharp(file.buffer)
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer();

  const key = `menu-items/${menuItemId}/${randomUUID()}.webp`;
  await putObject(key, optimised, "image/webp");

  return createMenuItemImage({
    menuItemId,
    url: publicUrl(key),
    storageKey: key,
    isPrimary: existing === 0,
    sortOrder: existing,
  });
};

/** Delete an image from storage and the DB. */
export const removeItemImage = async (
  imageId: string,
): Promise<MenuItemImage> => {
  const image = await findMenuItemImageById(imageId);
  if (!image) {
    throw new Error(IMAGE_NOT_FOUND);
  }
  await deleteObject(image.storageKey);
  await deleteMenuItemImage(imageId);
  return image;
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

/** Add an image after checking the item belongs to the restaurant. */
export const addItemImageForRestaurant = (
  restaurantId: string,
  itemId: string,
  file: UploadFile,
): Promise<MenuItemImage> =>
  assertItemOwned(restaurantId, itemId).then(() => addItemImage(itemId, file));

/** Remove an image after checking its item belongs to the restaurant. */
export const removeItemImageForRestaurant = async (
  restaurantId: string,
  imageId: string,
): Promise<void> => {
  const image = await findMenuItemImageById(imageId);
  if (!image) {
    throw new Error(IMAGE_NOT_FOUND);
  }
  await assertItemOwned(restaurantId, image.menuItemId);
  await deleteObject(image.storageKey);
  await deleteMenuItemImage(imageId);
};
