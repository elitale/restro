import sharp from "sharp";

import { deleteObject, publicUrl, putObject } from "@/lib/storage";
import {
  findStaffById,
  setStaffPhoto,
} from "@/repositories/staff.repository";
import { STAFF_FORBIDDEN, STAFF_NOT_FOUND } from "@/services/staff.service";

export const IMAGE_TYPE_INVALID = "IMAGE_TYPE_INVALID";
export const IMAGE_TOO_LARGE = "IMAGE_TOO_LARGE";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface UploadFile {
  readonly buffer: Buffer;
  readonly type: string;
  readonly size: number;
}

const assertOwned = async (
  restaurantId: string,
  staffId: string,
): Promise<void> => {
  const staff = await findStaffById(staffId);
  if (!staff || staff.deletedAt) {
    throw new Error(STAFF_NOT_FOUND);
  }
  if (staff.restaurantId !== restaurantId) {
    throw new Error(STAFF_FORBIDDEN);
  }
};

export const uploadStaffPhoto = async (
  restaurantId: string,
  staffId: string,
  file: UploadFile,
): Promise<string> => {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(IMAGE_TYPE_INVALID);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(IMAGE_TOO_LARGE);
  }
  await assertOwned(restaurantId, staffId);
  const optimised = await sharp(file.buffer)
    .rotate()
    .resize({ width: 512, height: 512, fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer();
  const key = `staff/${staffId}/photo.webp`;
  await putObject(key, optimised, "image/webp");
  const url = `${publicUrl(key)}?v=${Date.now()}`;
  await setStaffPhoto(staffId, url);
  return url;
};

export const removeStaffPhoto = async (
  restaurantId: string,
  staffId: string,
): Promise<void> => {
  await assertOwned(restaurantId, staffId);
  await deleteObject(`staff/${staffId}/photo.webp`);
  await setStaffPhoto(staffId, null);
};
