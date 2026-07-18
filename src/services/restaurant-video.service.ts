import { randomUUID } from "node:crypto";

import { deleteObject, publicUrl, putObject } from "@/lib/storage";
import {
  countRestaurantVideos,
  createRestaurantVideo,
  deleteRestaurantVideo,
  findRestaurantVideoById,
} from "@/repositories/restaurant.repository";

export const VIDEO_TYPE_INVALID = "VIDEO_TYPE_INVALID";
export const VIDEO_TOO_LARGE = "VIDEO_TOO_LARGE";
export const VIDEO_LIMIT_REACHED = "VIDEO_LIMIT_REACHED";
export const VIDEO_NOT_FOUND = "VIDEO_NOT_FOUND";
export const VIDEO_FORBIDDEN = "VIDEO_FORBIDDEN";

const MAX_VIDEOS = 6;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const EXTENSION: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export interface VideoUploadFile {
  readonly buffer: Buffer;
  readonly type: string;
  readonly size: number;
}

const nextSlotUnderCap = async (restaurantId: string): Promise<number> => {
  const count = await countRestaurantVideos(restaurantId);
  if (count >= MAX_VIDEOS) {
    throw new Error(VIDEO_LIMIT_REACHED);
  }
  return count;
};

/** Record an external video link (YouTube / Instagram / Vimeo …). */
export const addVideoLink = async (
  restaurantId: string,
  url: string,
  caption?: string,
): Promise<void> => {
  const sortOrder = await nextSlotUnderCap(restaurantId);
  await createRestaurantVideo({
    restaurantId,
    kind: "LINK",
    url,
    storageKey: null,
    caption: caption ?? null,
    sortOrder,
  });
};

/** Upload a short promo video file to storage and record it. */
export const uploadVideoFile = async (
  restaurantId: string,
  file: VideoUploadFile,
  caption?: string,
): Promise<void> => {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(VIDEO_TYPE_INVALID);
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(VIDEO_TOO_LARGE);
  }
  const sortOrder = await nextSlotUnderCap(restaurantId);
  const key = `restaurants/${restaurantId}/videos/${randomUUID()}.${
    EXTENSION[file.type] ?? "mp4"
  }`;
  await putObject(key, file.buffer, file.type);
  await createRestaurantVideo({
    restaurantId,
    kind: "FILE",
    url: publicUrl(key),
    storageKey: key,
    caption: caption ?? null,
    sortOrder,
  });
};

export const removeVideo = async (
  restaurantId: string,
  id: string,
): Promise<void> => {
  const video = await findRestaurantVideoById(id);
  if (!video) {
    throw new Error(VIDEO_NOT_FOUND);
  }
  if (video.restaurantId !== restaurantId) {
    throw new Error(VIDEO_FORBIDDEN);
  }
  if (video.storageKey) {
    await deleteObject(video.storageKey);
  }
  await deleteRestaurantVideo(id);
};
