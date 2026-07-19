"use server";

import { withManagerValidation } from "@/actions/helpers";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import {
  addVideoLinkSchema,
  removeGalleryImageSchema,
  removeVideoSchema,
  setSelfOrderSchema,
  updateProfileSchema,
  updateTaxProfileSchema,
  updateUsernameSchema,
} from "@/lib/validators/restaurant";
import {
  addGalleryImage,
  removeCover,
  removeGalleryImage,
  removeLogo,
  uploadCover,
  uploadLogo,
  type UploadFile,
} from "@/services/restaurant-image.service";
import {
  updateRestaurantProfile,
  updateTaxProfile,
  updateUsername,
  regenerateUsername,
  setSelfOrderEnabled,
} from "@/services/restaurant-settings.service";
import {
  addVideoLink,
  removeVideo,
  uploadVideoFile,
} from "@/services/restaurant-video.service";
import { failure, success, type ActionResult } from "@/types";

export const updateTaxProfileAction = withManagerValidation(
  updateTaxProfileSchema,
  (data, ctx) => updateTaxProfile(ctx.restaurantId, data),
);

export const updateRestaurantProfileAction = withManagerValidation(
  updateProfileSchema,
  (data, ctx) => updateRestaurantProfile(ctx.restaurantId, data),
);

export const updateUsernameAction = withManagerValidation(
  updateUsernameSchema,
  (data, ctx) => updateUsername(ctx.restaurantId, data.username),
);

export const setSelfOrderEnabledAction = withManagerValidation(
  setSelfOrderSchema,
  (data, ctx) => setSelfOrderEnabled(ctx.restaurantId, data.enabled),
);

export const regenerateUsernameAction = async (): Promise<
  ActionResult<string>
> => {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return failure<string>("NO_RESTAURANT");
  }
  try {
    return success(await regenerateUsername(ctx.restaurantId));
  } catch (error) {
    return failure<string>(
      error instanceof Error ? error.message : "Something went wrong",
    );
  }
};

export const removeGalleryImageAction = withManagerValidation(
  removeGalleryImageSchema,
  (data, ctx) => removeGalleryImage(ctx.restaurantId, data.imageId),
);

export const addVideoLinkAction = withManagerValidation(
  addVideoLinkSchema,
  (data, ctx) => addVideoLink(ctx.restaurantId, data.url, data.caption),
);

export const removeVideoAction = withManagerValidation(
  removeVideoSchema,
  (data, ctx) => removeVideo(ctx.restaurantId, data.id),
);

const runFileUpload = async <R>(
  formData: FormData,
  handler: (restaurantId: string, file: UploadFile) => Promise<R>,
): Promise<ActionResult<R>> => {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return failure<R>("NO_RESTAURANT");
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return failure<R>("Invalid upload");
  }
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    return success(
      await handler(ctx.restaurantId, {
        buffer,
        type: file.type,
        size: file.size,
      }),
    );
  } catch (error) {
    return failure<R>(error instanceof Error ? error.message : "Upload failed");
  }
};

const runOwned = async (
  handler: (restaurantId: string) => Promise<void>,
): Promise<ActionResult<void>> => {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return failure("NO_RESTAURANT");
  }
  try {
    await handler(ctx.restaurantId);
    return success(undefined);
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Something went wrong",
    );
  }
};

export const uploadLogoAction = async (
  formData: FormData,
): Promise<ActionResult<string>> => runFileUpload(formData, uploadLogo);

export const uploadCoverAction = async (
  formData: FormData,
): Promise<ActionResult<string>> => runFileUpload(formData, uploadCover);

export const uploadGalleryImageAction = async (
  formData: FormData,
): Promise<ActionResult<void>> => runFileUpload(formData, addGalleryImage);

export const uploadVideoAction = async (
  formData: FormData,
): Promise<ActionResult<void>> => {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return failure("NO_RESTAURANT");
  }
  const file = formData.get("file");
  const caption = formData.get("caption");
  if (!(file instanceof File)) {
    return failure("Invalid upload");
  }
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadVideoFile(
      ctx.restaurantId,
      { buffer, type: file.type, size: file.size },
      typeof caption === "string" && caption.trim() ? caption.trim() : undefined,
    );
    return success(undefined);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Upload failed");
  }
};

export const removeLogoAction = async (): Promise<ActionResult<void>> =>
  runOwned(removeLogo);

export const removeCoverAction = async (): Promise<ActionResult<void>> =>
  runOwned(removeCover);
