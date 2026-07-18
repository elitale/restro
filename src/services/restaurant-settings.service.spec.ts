import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import type { Restaurant } from "@/generated/prisma/client";

vi.mock("@/repositories/restaurant.repository", () => ({
  findRestaurantById: vi.fn(),
  updateRestaurantTaxProfile: vi.fn(),
}));

import {
  findRestaurantById,
  updateRestaurantTaxProfile,
} from "@/repositories/restaurant.repository";
import {
  getTaxProfile,
  RESTAURANT_NOT_FOUND,
  updateTaxProfile,
} from "./restaurant-settings.service";

const makeRestaurant = (overrides: Partial<Restaurant> = {}): Restaurant => ({
  id: "res_1",
  name: "Spice Route",
  slug: "spice-route",
  email: null,
  phone: null,
  city: null,
  country: "IN",
  timezone: null,
  gstRegistrationType: "UNREGISTERED",
  serviceGstRate: null,
  pricesTaxInclusive: false,
  gstin: null,
  sacCode: "996331",
  nextInvoiceSeq: 1,
  isActive: true,
  onboardedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ownerId: "usr_1",
  ...overrides,
});

describe("getTaxProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps the restaurant tax fields (Decimal → number)", async () => {
    vi.mocked(findRestaurantById).mockResolvedValue(
      makeRestaurant({
        gstRegistrationType: "REGULAR",
        serviceGstRate: new Prisma.Decimal(5),
        gstin: "22AAAAA0000A1Z5",
      }),
    );

    const profile = await getTaxProfile("res_1");

    expect(profile).toMatchObject({
      gstRegistrationType: "REGULAR",
      serviceGstRate: 5,
      gstin: "22AAAAA0000A1Z5",
      sacCode: "996331",
    });
  });

  it("throws when the restaurant is missing", async () => {
    vi.mocked(findRestaurantById).mockResolvedValue(null);
    await expect(getTaxProfile("res_1")).rejects.toThrow(RESTAURANT_NOT_FOUND);
  });
});

describe("updateTaxProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clears GST fields when unregistered", async () => {
    await updateTaxProfile("res_1", {
      gstRegistrationType: "UNREGISTERED",
      pricesTaxInclusive: false,
    });

    expect(updateRestaurantTaxProfile).toHaveBeenCalledWith(
      "res_1",
      expect.objectContaining({
        serviceGstRate: null,
        gstin: null,
        sacCode: null,
      }),
    );
  });

  it("stores the rate and GSTIN when regular", async () => {
    await updateTaxProfile("res_1", {
      gstRegistrationType: "REGULAR",
      serviceGstRate: 5,
      pricesTaxInclusive: true,
      gstin: "22AAAAA0000A1Z5",
      sacCode: "996331",
    });

    expect(updateRestaurantTaxProfile).toHaveBeenCalledWith(
      "res_1",
      expect.objectContaining({
        gstRegistrationType: "REGULAR",
        serviceGstRate: 5,
        gstin: "22AAAAA0000A1Z5",
        sacCode: "996331",
        pricesTaxInclusive: true,
      }),
    );
  });
});
