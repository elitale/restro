import { randomUUID } from "node:crypto";

import sharp from "sharp";

import { deleteObject, publicUrl, putObject } from "@/lib/storage";
import {
  countRestaurantImages,
  createRestaurantImage,
  deleteRestaurantImage,
  findRestaurantImageById,
  updateRestaurant,
} from "@/repositories/restaurant.repository";

export const IMAGE_TYPE_INVALID = "IMAGE_TYPE_INVALID";
export const IMAGE_TOO_LARGE = "IMAGE_TOO_LARGE";
export const GALLERY_LIMIT_REACHED = "GALLERY_LIMIT_REACHED";
export const IMAGE_NOT_FOUND = "IMAGE_NOT_FOUND";
export const IMAGE_FORBIDDEN = "IMAGE_FORBIDDEN";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_GALLERY = 8;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface UploadFile {
  readonly buffer: Buffer;
  readonly type: string;
  readonly size: number;
}

const validate = (file: UploadFile): void => {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(IMAGE_TYPE_INVALID);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(IMAGE_TOO_LARGE);
  }
};

const optimise = (
  buffer: Buffer,
  width: number,
  height: number,
  fit: "inside" | "cover",
): Promise<Buffer> =>
  sharp(buffer)
    .rotate()
    .resize({ width, height, fit, withoutEnlargement: fit === "inside" })
    .webp({ quality: 82 })
    .toBuffer();

/** Upload/replace the logo (fixed key, cache-busted url). */
export const uploadLogo = async (
  restaurantId: string,
  file: UploadFile,
): Promise<string> => {
  validate(file);
  const optimised = await optimise(file.buffer, 512, 512, "inside");
  const key = `restaurants/${restaurantId}/logo.webp`;
  await putObject(key, optimised, "image/webp");
  const url = `${publicUrl(key)}?v=${Date.now()}`;
  await updateRestaurant(restaurantId, { logoUrl: url });
  return url;
};

export const removeLogo = async (restaurantId: string): Promise<void> => {
  await deleteObject(`restaurants/${restaurantId}/logo.webp`);
  await updateRestaurant(restaurantId, { logoUrl: null });
};

/** Upload/replace the cover banner. */
export const uploadCover = async (
  restaurantId: string,
  file: UploadFile,
): Promise<string> => {
  validate(file);
  const optimised = await optimise(file.buffer, 1600, 500, "cover");
  const key = `restaurants/${restaurantId}/cover.webp`;
  await putObject(key, optimised, "image/webp");
  const url = `${publicUrl(key)}?v=${Date.now()}`;
  await updateRestaurant(restaurantId, { coverUrl: url });
  return url;
};

export const removeCover = async (restaurantId: string): Promise<void> => {
  await deleteObject(`restaurants/${restaurantId}/cover.webp`);
  await updateRestaurant(restaurantId, { coverUrl: null });
};

/** Add a gallery image (capped). */
export const addGalleryImage = async (
  restaurantId: string,
  file: UploadFile,
): Promise<void> => {
  validate(file);
  const existing = await countRestaurantImages(restaurantId);
  if (existing >= MAX_GALLERY) {
    throw new Error(GALLERY_LIMIT_REACHED);
  }
  const optimised = await optimise(file.buffer, 1600, 1600, "inside");
  const key = `restaurants/${restaurantId}/gallery-${randomUUID()}.webp`;
  await putObject(key, optimised, "image/webp");
  await createRestaurantImage({
    restaurantId,
    url: publicUrl(key),
    storageKey: key,
    sortOrder: existing,
  });
};

export const removeGalleryImage = async (
  restaurantId: string,
  imageId: string,
): Promise<void> => {
  const image = await findRestaurantImageById(imageId);
  if (!image) {
    throw new Error(IMAGE_NOT_FOUND);
  }
  if (image.restaurantId !== restaurantId) {
    throw new Error(IMAGE_FORBIDDEN);
  }
  await deleteObject(image.storageKey);
  await deleteRestaurantImage(imageId);
};
