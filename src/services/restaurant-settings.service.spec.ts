import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import type { Restaurant } from "@/generated/prisma/client";

vi.mock("@/repositories/restaurant.repository", () => ({
  findRestaurantById: vi.fn(),
  findRestaurantImages: vi.fn(),
  findRestaurantVideos: vi.fn(),
  updateRestaurant: vi.fn(),
  updateRestaurantTaxProfile: vi.fn(),
}));

import {
  findRestaurantById,
  findRestaurantImages,
  findRestaurantVideos,
  updateRestaurant,
  updateRestaurantTaxProfile,
} from "@/repositories/restaurant.repository";
import {
  fssaiStatus,
  getRestaurantProfile,
  getServiceOptions,
  getTaxProfile,
  RESTAURANT_NOT_FOUND,
  updateRestaurantProfile,
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
  legalName: null,
  tagline: null,
  brandColor: null,
  logoUrl: null,
  coverUrl: null,
  addressLine1: null,
  addressLine2: null,
  state: null,
  postalCode: null,
  website: null,
  instagramUrl: null,
  facebookUrl: null,
  googleUrl: null,
  restaurantFormat: null,
  cuisines: [],
  seatingCapacity: null,
  fssaiLicense: null,
  fssaiExpiry: null,
  panNumber: null,
  serviceDineIn: true,
  serviceTakeaway: true,
  serviceDelivery: false,
  defaultOrderType: "TAKEAWAY",
  businessHours: null,
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

describe("getRestaurantProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps profile fields, FSSAI status and gallery", async () => {
    const past = new Date(Date.now() - 1000);
    vi.mocked(findRestaurantById).mockResolvedValue(
      makeRestaurant({ legalName: "Spice Route Pvt Ltd", fssaiExpiry: past }),
    );
    vi.mocked(findRestaurantImages).mockResolvedValue([
      { id: "gi1", url: "https://cdn.test/g1" },
    ] as unknown as Awaited<ReturnType<typeof findRestaurantImages>>);
    vi.mocked(findRestaurantVideos).mockResolvedValue([
      { id: "v1", kind: "LINK", url: "https://youtu.be/abc", caption: null },
    ] as unknown as Awaited<ReturnType<typeof findRestaurantVideos>>);

    const profile = await getRestaurantProfile("res_1");

    expect(profile.legalName).toBe("Spice Route Pvt Ltd");
    expect(profile.fssaiStatus).toBe("expired");
    expect(profile.gallery).toEqual([{ id: "gi1", url: "https://cdn.test/g1" }]);
    expect(profile.videos).toEqual([
      { id: "v1", kind: "LINK", url: "https://youtu.be/abc", caption: null },
    ]);
    expect(profile.serviceDineIn).toBe(true);
  });
});

describe("updateRestaurantProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("nulls cleared optional fields and writes service options", async () => {
    await updateRestaurantProfile("res_1", {
      name: "Spice Route",
      cuisines: ["North Indian"],
      serviceDineIn: true,
      serviceTakeaway: false,
      serviceDelivery: true,
      defaultOrderType: "DELIVERY",
    });

    expect(updateRestaurant).toHaveBeenCalledWith(
      "res_1",
      expect.objectContaining({
        name: "Spice Route",
        legalName: null,
        cuisines: ["North Indian"],
        serviceTakeaway: false,
        serviceDelivery: true,
      }),
    );
  });
});

describe("fssaiStatus", () => {
  it("classifies none / expired / expiring / ok", () => {
    expect(fssaiStatus(null)).toBe("none");
    expect(fssaiStatus(new Date(Date.now() - 1000))).toBe("expired");
    expect(fssaiStatus(new Date(Date.now() + 5 * 24 * 3600 * 1000))).toBe(
      "expiring",
    );
    expect(fssaiStatus(new Date(Date.now() + 90 * 24 * 3600 * 1000))).toBe("ok");
  });
});

describe("getServiceOptions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the three service flags", async () => {
    vi.mocked(findRestaurantById).mockResolvedValue(
      makeRestaurant({ serviceDineIn: false, serviceDelivery: true }),
    );

    expect(await getServiceOptions("res_1")).toEqual({
      dineIn: false,
      takeaway: true,
      delivery: true,
      defaultType: "TAKEAWAY",
    });
  });
});
