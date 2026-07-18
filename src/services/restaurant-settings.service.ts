import type { UpdateTaxProfileInput } from "@/lib/validators/restaurant";
import {
  findRestaurantById,
  updateRestaurantTaxProfile,
} from "@/repositories/restaurant.repository";
import type { TaxProfileDTO } from "@/types/settings";

export const RESTAURANT_NOT_FOUND = "RESTAURANT_NOT_FOUND";

export const getTaxProfile = async (
  restaurantId: string,
): Promise<TaxProfileDTO> => {
  const restaurant = await findRestaurantById(restaurantId);
  if (!restaurant || restaurant.deletedAt) {
    throw new Error(RESTAURANT_NOT_FOUND);
  }
  return {
    gstRegistrationType: restaurant.gstRegistrationType,
    serviceGstRate:
      restaurant.serviceGstRate != null
        ? Number(restaurant.serviceGstRate)
        : null,
    pricesTaxInclusive: restaurant.pricesTaxInclusive,
    gstin: restaurant.gstin,
    sacCode: restaurant.sacCode,
  };
};

export const updateTaxProfile = async (
  restaurantId: string,
  input: UpdateTaxProfileInput,
): Promise<void> => {
  const unregistered = input.gstRegistrationType === "UNREGISTERED";
  await updateRestaurantTaxProfile(restaurantId, {
    gstRegistrationType: input.gstRegistrationType,
    serviceGstRate: unregistered ? null : input.serviceGstRate ?? null,
    pricesTaxInclusive: input.pricesTaxInclusive,
    gstin: unregistered ? null : input.gstin ?? null,
    sacCode: unregistered ? null : input.sacCode ?? null,
  });
};
