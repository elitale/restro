"use server";

import { withManagerValidation } from "@/actions/helpers";
import { updateTaxProfileSchema } from "@/lib/validators/restaurant";
import { updateTaxProfile } from "@/services/restaurant-settings.service";

export const updateTaxProfileAction = withManagerValidation(
  updateTaxProfileSchema,
  (data, ctx) => updateTaxProfile(ctx.restaurantId, data),
);
