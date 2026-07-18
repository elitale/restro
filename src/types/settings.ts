import type { OrderType } from "@/types/order";

export type GstRegistrationType = "REGULAR" | "COMPOSITION" | "UNREGISTERED";

export interface TaxProfileDTO {
  readonly gstRegistrationType: GstRegistrationType;
  readonly serviceGstRate: number | null;
  readonly pricesTaxInclusive: boolean;
  readonly gstin: string | null;
  readonly sacCode: string | null;
}

export type RestaurantFormat =
  | "FINE_DINING"
  | "CASUAL_DINING"
  | "QSR"
  | "CAFE"
  | "CLOUD_KITCHEN"
  | "BAR"
  | "BAKERY"
  | "FOOD_TRUCK"
  | "OTHER";

export type FssaiStatus = "none" | "ok" | "expiring" | "expired";

export interface BusinessHoursDTO {
  readonly day: number; // 0 = Sunday … 6 = Saturday
  readonly isClosed: boolean;
  readonly opensAt: string; // HH:MM
  readonly closesAt: string; // HH:MM
}

export interface RestaurantImageDTO {
  readonly id: string;
  readonly url: string;
}

export type VideoKind = "LINK" | "FILE";

export interface RestaurantVideoDTO {
  readonly id: string;
  readonly kind: VideoKind;
  readonly url: string;
  readonly caption: string | null;
}

export interface ServiceOptions {
  readonly dineIn: boolean;
  readonly takeaway: boolean;
  readonly delivery: boolean;
  readonly defaultType: OrderType;
}

export interface RestaurantProfileDTO {
  readonly name: string;
  readonly legalName: string | null;
  readonly tagline: string | null;
  readonly brandColor: string | null;
  readonly logoUrl: string | null;
  readonly coverUrl: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly postalCode: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly website: string | null;
  readonly instagramUrl: string | null;
  readonly facebookUrl: string | null;
  readonly googleUrl: string | null;
  readonly restaurantFormat: RestaurantFormat | null;
  readonly cuisines: readonly string[];
  readonly seatingCapacity: number | null;
  readonly fssaiLicense: string | null;
  readonly fssaiExpiry: string | null;
  readonly fssaiStatus: FssaiStatus;
  readonly panNumber: string | null;
  readonly serviceDineIn: boolean;
  readonly serviceTakeaway: boolean;
  readonly serviceDelivery: boolean;
  readonly defaultOrderType: OrderType;
  readonly businessHours: readonly BusinessHoursDTO[] | null;
  readonly gallery: readonly RestaurantImageDTO[];
  readonly videos: readonly RestaurantVideoDTO[];
}
