"use server";

import { withAdminValidation } from "@/actions/helpers";
import { onboardRestaurantSchema } from "@/lib/validators/admin";
import { onboardRestaurant } from "@/services/restaurant.service";

export const onboardRestaurantAction = withAdminValidation(
  onboardRestaurantSchema,
  (data) => onboardRestaurant(data),
);
