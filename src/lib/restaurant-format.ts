import type { RestaurantFormat } from "@/types/settings";

export const FORMAT_LABELS: Record<RestaurantFormat, string> = {
  FINE_DINING: "Fine dining",
  CASUAL_DINING: "Casual dining",
  QSR: "Quick service (QSR)",
  CAFE: "Café",
  CLOUD_KITCHEN: "Cloud kitchen",
  BAR: "Bar / Pub",
  BAKERY: "Bakery",
  FOOD_TRUCK: "Food truck",
  OTHER: "Other",
};

export const FORMAT_OPTIONS = (
  Object.keys(FORMAT_LABELS) as RestaurantFormat[]
).map((value) => ({ value, label: FORMAT_LABELS[value] }));

export const CUISINE_OPTIONS: readonly string[] = [
  "North Indian",
  "South Indian",
  "Chinese",
  "Continental",
  "Italian",
  "Mughlai",
  "Bengali",
  "Punjabi",
  "Fast Food",
  "Desserts",
  "Beverages",
  "Street Food",
  "Biryani",
  "Tandoor",
  "Seafood",
  "Vegan",
];
