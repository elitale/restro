import type { StockMovementType, StockUnit } from "@/types/inventory";

export const UNIT_LABELS: Record<StockUnit, string> = {
  KG: "kg",
  GRAM: "g",
  LITRE: "L",
  ML: "ml",
  PIECE: "pc",
  PACK: "pack",
  BOTTLE: "bottle",
  DOZEN: "dozen",
};

export const STOCK_UNIT_OPTIONS: readonly { value: StockUnit; label: string }[] = [
  { value: "KG", label: "Kilogram (kg)" },
  { value: "GRAM", label: "Gram (g)" },
  { value: "LITRE", label: "Litre (L)" },
  { value: "ML", label: "Millilitre (ml)" },
  { value: "PIECE", label: "Piece (pc)" },
  { value: "PACK", label: "Pack" },
  { value: "BOTTLE", label: "Bottle" },
  { value: "DOZEN", label: "Dozen" },
];

export const WASTE_REASONS: readonly string[] = [
  "Spoiled",
  "Expired",
  "Breakage",
  "Prep loss",
  "Over-portion",
  "Comp / staff meal",
];

export const MOVEMENT_LABELS: Record<StockMovementType, string> = {
  RECEIVE: "Received",
  WASTE: "Wasted",
  CORRECTION: "Count / correction",
  SALE_DEPLETION: "Sale",
};
