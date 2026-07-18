export type GstRegistrationType = "REGULAR" | "COMPOSITION" | "UNREGISTERED";

export interface TaxProfileDTO {
  readonly gstRegistrationType: GstRegistrationType;
  readonly serviceGstRate: number | null;
  readonly pricesTaxInclusive: boolean;
  readonly gstin: string | null;
  readonly sacCode: string | null;
}
