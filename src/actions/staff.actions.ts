"use server";

import { withManagerValidation } from "@/actions/helpers";
import { getManagerContextOrNull } from "@/lib/manager-auth";
import {
  createStaffSchema,
  deleteStaffSchema,
  resetPinSchema,
  updateStaffSchema,
} from "@/lib/validators/staff";
import {
  removeStaffPhoto,
  uploadStaffPhoto,
} from "@/services/staff-image.service";
import {
  createStaff,
  deleteStaff,
  resetPin,
  updateStaff,
} from "@/services/staff.service";
import { failure, success, type ActionResult } from "@/types";

export const createStaffAction = withManagerValidation(
  createStaffSchema,
  (data, ctx) => createStaff(ctx, data),
);

export const updateStaffAction = withManagerValidation(
  updateStaffSchema,
  (data, ctx) => updateStaff(ctx, data),
);

export const deleteStaffAction = withManagerValidation(
  deleteStaffSchema,
  (data, ctx) => deleteStaff(ctx, data),
);

export const resetPinAction = withManagerValidation(resetPinSchema, (data, ctx) =>
  resetPin(ctx, data),
);

export const uploadStaffPhotoAction = async (
  formData: FormData,
): Promise<ActionResult<string>> => {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return failure("NO_RESTAURANT");
  }
  const staffId = formData.get("staffId");
  const file = formData.get("file");
  if (typeof staffId !== "string" || !(file instanceof File)) {
    return failure("Invalid upload");
  }
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    return success(
      await uploadStaffPhoto(ctx.restaurantId, staffId, {
        buffer,
        type: file.type,
        size: file.size,
      }),
    );
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Upload failed");
  }
};

export const removeStaffPhotoAction = async (
  staffId: string,
): Promise<ActionResult<void>> => {
  const ctx = await getManagerContextOrNull();
  if (!ctx) {
    return failure("NO_RESTAURANT");
  }
  try {
    await removeStaffPhoto(ctx.restaurantId, staffId);
    return success(undefined);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Something went wrong");
  }
};
