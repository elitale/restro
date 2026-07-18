export type StockUnit =
  | "KG"
  | "GRAM"
  | "LITRE"
  | "ML"
  | "PIECE"
  | "PACK"
  | "BOTTLE"
  | "DOZEN";

export type StockMovementType =
  | "RECEIVE"
  | "WASTE"
  | "CORRECTION"
  | "SALE_DEPLETION";

export interface StockItemDTO {
  readonly id: string;
  readonly name: string;
  readonly unit: StockUnit;
  readonly category: string | null;
  readonly onHand: number;
  readonly reorderLevel: number | null;
  readonly parLevel: number | null;
  readonly costPerUnit: number | null;
  readonly supplier: string | null;
  readonly notes: string | null;
  readonly isActive: boolean;
  readonly isLow: boolean;
}

export interface StockMovementDTO {
  readonly id: string;
  readonly type: StockMovementType;
  readonly quantity: number;
  readonly resultingOnHand: number;
  readonly reason: string | null;
  readonly note: string | null;
  readonly createdAt: string;
}

export interface RecipeComponentDTO {
  readonly id: string;
  readonly stockItemId: string;
  readonly stockItemName: string;
  readonly unit: StockUnit;
  readonly quantity: number;
}
