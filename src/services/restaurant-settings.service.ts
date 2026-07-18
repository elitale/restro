import type { Prisma } from "@/generated/prisma/client";
import {
  businessHoursSchema,
  type UpdateProfileInput,
  type UpdateTaxProfileInput,
} from "@/lib/validators/restaurant";
import {
  findRestaurantById,
  findRestaurantByUsername,
  findRestaurantImages,
  findRestaurantVideos,
  updateRestaurant,
  updateRestaurantTaxProfile,
} from "@/repositories/restaurant.repository";
import { generateUniqueUsername } from "@/services/restaurant.service";
import type {
  BusinessHoursDTO,
  FssaiStatus,
  RestaurantProfileDTO,
  ServiceOptions,
  TaxProfileDTO,
} from "@/types/settings";

export const RESTAURANT_NOT_FOUND = "RESTAURANT_NOT_FOUND";
export const USERNAME_TAKEN = "USERNAME_TAKEN";

/** Return the restaurant's username, lazily generating one if it has none. */
const resolveUsername = async (restaurant: {
  id: string;
  username: string | null;
}): Promise<string> => {
  if (restaurant.username) {
    return restaurant.username;
  }
  const username = await generateUniqueUsername();
  await updateRestaurant(restaurant.id, { username });
  return username;
};

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

// ---------------------------------------------------------------- profile ---

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const fssaiStatus = (expiry: Date | null): FssaiStatus => {
  if (!expiry) {
    return "none";
  }
  const now = Date.now();
  if (expiry.getTime() < now) {
    return "expired";
  }
  if (expiry.getTime() < now + THIRTY_DAYS_MS) {
    return "expiring";
  }
  return "ok";
};

const parseBusinessHours = (
  value: Prisma.JsonValue | null,
): BusinessHoursDTO[] | null => {
  if (value == null) {
    return null;
  }
  const parsed = businessHoursSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const getRestaurantProfile = async (
  restaurantId: string,
): Promise<RestaurantProfileDTO> => {
  const [restaurant, images, videos] = await Promise.all([
    findRestaurantById(restaurantId),
    findRestaurantImages(restaurantId),
    findRestaurantVideos(restaurantId),
  ]);
  if (!restaurant || restaurant.deletedAt) {
    throw new Error(RESTAURANT_NOT_FOUND);
  }
  const username = await resolveUsername(restaurant);
  return {
    username,
    name: restaurant.name,
    legalName: restaurant.legalName,
    tagline: restaurant.tagline,
    brandColor: restaurant.brandColor,
    logoUrl: restaurant.logoUrl,
    coverUrl: restaurant.coverUrl,
    addressLine1: restaurant.addressLine1,
    addressLine2: restaurant.addressLine2,
    city: restaurant.city,
    state: restaurant.state,
    postalCode: restaurant.postalCode,
    phone: restaurant.phone,
    email: restaurant.email,
    website: restaurant.website,
    instagramUrl: restaurant.instagramUrl,
    facebookUrl: restaurant.facebookUrl,
    googleUrl: restaurant.googleUrl,
    restaurantFormat: restaurant.restaurantFormat,
    cuisines: restaurant.cuisines,
    seatingCapacity: restaurant.seatingCapacity,
    fssaiLicense: restaurant.fssaiLicense,
    fssaiExpiry: restaurant.fssaiExpiry
      ? restaurant.fssaiExpiry.toISOString()
      : null,
    fssaiStatus: fssaiStatus(restaurant.fssaiExpiry),
    panNumber: restaurant.panNumber,
    serviceDineIn: restaurant.serviceDineIn,
    serviceTakeaway: restaurant.serviceTakeaway,
    serviceDelivery: restaurant.serviceDelivery,
    defaultOrderType: restaurant.defaultOrderType,
    businessHours: parseBusinessHours(restaurant.businessHours),
    gallery: images.map((image) => ({ id: image.id, url: image.url })),
    videos: videos.map((video) => ({
      id: video.id,
      kind: video.kind,
      url: video.url,
      caption: video.caption,
    })),
  };
};

export const updateRestaurantProfile = async (
  restaurantId: string,
  input: UpdateProfileInput,
): Promise<void> => {
  await updateRestaurant(restaurantId, {
    name: input.name,
    legalName: input.legalName ?? null,
    tagline: input.tagline ?? null,
    brandColor: input.brandColor ?? null,
    addressLine1: input.addressLine1 ?? null,
    addressLine2: input.addressLine2 ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    postalCode: input.postalCode ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    website: input.website ?? null,
    instagramUrl: input.instagramUrl ?? null,
    facebookUrl: input.facebookUrl ?? null,
    googleUrl: input.googleUrl ?? null,
    restaurantFormat: input.restaurantFormat ?? null,
    cuisines: input.cuisines,
    seatingCapacity: input.seatingCapacity ?? null,
    fssaiLicense: input.fssaiLicense ?? null,
    fssaiExpiry: input.fssaiExpiry ?? null,
    panNumber: input.panNumber ?? null,
    serviceDineIn: input.serviceDineIn,
    serviceTakeaway: input.serviceTakeaway,
    serviceDelivery: input.serviceDelivery,
    defaultOrderType: input.defaultOrderType,
    ...(input.businessHours
      ? { businessHours: input.businessHours as Prisma.InputJsonValue }
      : {}),
  });
};

export const getServiceOptions = async (
  restaurantId: string,
): Promise<ServiceOptions> => {
  const restaurant = await findRestaurantById(restaurantId);
  if (!restaurant || restaurant.deletedAt) {
    throw new Error(RESTAURANT_NOT_FOUND);
  }
  return {
    dineIn: restaurant.serviceDineIn,
    takeaway: restaurant.serviceTakeaway,
    delivery: restaurant.serviceDelivery,
    defaultType: restaurant.defaultOrderType,
  };
};

/** Set a custom username, rejecting one already taken by another restaurant. */
export const updateUsername = async (
  restaurantId: string,
  username: string,
): Promise<void> => {
  const existing = await findRestaurantByUsername(username);
  if (existing && existing.id !== restaurantId) {
    throw new Error(USERNAME_TAKEN);
  }
  await updateRestaurant(restaurantId, { username });
};

/** Replace the username with a fresh, unused 7-character one. */
export const regenerateUsername = async (
  restaurantId: string,
): Promise<string> => {
  const username = await generateUniqueUsername();
  await updateRestaurant(restaurantId, { username });
  return username;
};
