import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import type { Restaurant } from "@/generated/prisma/client";

vi.mock("@/repositories/restaurant.repository", () => ({
  findRestaurantById: vi.fn(),
  findRestaurantByUsername: vi.fn(),
  findRestaurantImages: vi.fn(),
  findRestaurantVideos: vi.fn(),
  updateRestaurant: vi.fn(),
  updateRestaurantTaxProfile: vi.fn(),
}));
vi.mock("@/services/restaurant.service", () => ({
  generateUniqueUsername: vi.fn(),
}));

import {
  findRestaurantById,
  findRestaurantByUsername,
  findRestaurantImages,
  findRestaurantVideos,
  updateRestaurant,
  updateRestaurantTaxProfile,
} from "@/repositories/restaurant.repository";
import { generateUniqueUsername } from "@/services/restaurant.service";
import {
  fssaiStatus,
  getInvoiceFooterNote,
  getRestaurantProfile,
  getSelfOrderEnabled,
  getSelfOrderShareInfo,
  getServiceOptions,
  getTaxProfile,
  clearGeolocation,
  regenerateUsername,
  RESTAURANT_NOT_FOUND,
  setInvoiceFooterNote,
  setSelfOrderEnabled,
  updateGeolocation,
  updateRestaurantProfile,
  updateTaxProfile,
  updateUsername,
  USERNAME_TAKEN,
} from "./restaurant-settings.service";

const makeRestaurant = (overrides: Partial<Restaurant> = {}): Restaurant => ({
  id: "res_1",
  name: "Spice Route",
  slug: "spice-route",
  username: null,
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
  latitude: null,
  longitude: null,
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
  selfOrderEnabled: false,
  invoiceFooterNote: null,
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
    vi.mocked(generateUniqueUsername).mockResolvedValue("spice12");
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

  it("lazily generates + persists a username when the row has none", async () => {
    vi.mocked(generateUniqueUsername).mockResolvedValue("newuser");
    vi.mocked(findRestaurantById).mockResolvedValue(makeRestaurant());
    vi.mocked(findRestaurantImages).mockResolvedValue([]);
    vi.mocked(findRestaurantVideos).mockResolvedValue([]);

    const profile = await getRestaurantProfile("res_1");

    expect(profile.username).toBe("newuser");
    expect(updateRestaurant).toHaveBeenCalledWith("res_1", {
      username: "newuser",
    });
  });

  it("keeps an existing username without regenerating", async () => {
    vi.mocked(findRestaurantById).mockResolvedValue(
      makeRestaurant({ username: "spice12" }),
    );
    vi.mocked(findRestaurantImages).mockResolvedValue([]);
    vi.mocked(findRestaurantVideos).mockResolvedValue([]);

    const profile = await getRestaurantProfile("res_1");

    expect(profile.username).toBe("spice12");
    expect(generateUniqueUsername).not.toHaveBeenCalled();
  });
});

describe("updateUsername / regenerateUsername", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves a free username", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValue(null);

    await updateUsername("res_1", "tasty1");

    expect(updateRestaurant).toHaveBeenCalledWith("res_1", {
      username: "tasty1",
    });
  });

  it("allows re-saving the restaurant's own username", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValue(
      makeRestaurant({ id: "res_1", username: "tasty1" }),
    );

    await expect(updateUsername("res_1", "tasty1")).resolves.toBeUndefined();
  });

  it("rejects a username taken by another restaurant", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValue(
      makeRestaurant({ id: "other", username: "tasty1" }),
    );

    await expect(updateUsername("res_1", "tasty1")).rejects.toThrow(
      USERNAME_TAKEN,
    );
    expect(updateRestaurant).not.toHaveBeenCalled();
  });

  it("regenerateUsername stores + returns a fresh one", async () => {
    vi.mocked(generateUniqueUsername).mockResolvedValue("fresh9");

    const result = await regenerateUsername("res_1");

    expect(result).toBe("fresh9");
    expect(updateRestaurant).toHaveBeenCalledWith("res_1", {
      username: "fresh9",
    });
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

describe("self-ordering flag", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads selfOrderEnabled", async () => {
    vi.mocked(findRestaurantById).mockResolvedValue(
      makeRestaurant({ selfOrderEnabled: true }),
    );

    expect(await getSelfOrderEnabled("res_1")).toBe(true);
  });

  it("throws when the restaurant is missing", async () => {
    vi.mocked(findRestaurantById).mockResolvedValue(null);

    await expect(getSelfOrderEnabled("res_1")).rejects.toThrow(
      RESTAURANT_NOT_FOUND,
    );
  });

  it("persists the new flag", async () => {
    await setSelfOrderEnabled("res_1", true);

    expect(updateRestaurant).toHaveBeenCalledWith("res_1", {
      selfOrderEnabled: true,
    });
  });
});

describe("invoice footer note", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the note (empty when unset)", async () => {
    vi.mocked(findRestaurantById).mockResolvedValue(
      makeRestaurant({ invoiceFooterNote: null }),
    );
    expect(await getInvoiceFooterNote("res_1")).toBe("");

    vi.mocked(findRestaurantById).mockResolvedValue(
      makeRestaurant({ invoiceFooterNote: "Thanks, visit again!" }),
    );
    expect(await getInvoiceFooterNote("res_1")).toBe("Thanks, visit again!");
  });

  it("persists a trimmed note, clearing to null when blank", async () => {
    await setInvoiceFooterNote("res_1", "  See you soon  ");
    expect(updateRestaurant).toHaveBeenCalledWith("res_1", {
      invoiceFooterNote: "See you soon",
    });

    await setInvoiceFooterNote("res_1", "   ");
    expect(updateRestaurant).toHaveBeenCalledWith("res_1", {
      invoiceFooterNote: null,
    });
  });
});

describe("getSelfOrderShareInfo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the username + enabled flag", async () => {
    vi.mocked(findRestaurantById).mockResolvedValue(
      makeRestaurant({ username: "elitale", selfOrderEnabled: true }),
    );

    expect(await getSelfOrderShareInfo("res_1")).toEqual({
      username: "elitale",
      enabled: true,
    });
  });

  it("throws when the restaurant is missing", async () => {
    vi.mocked(findRestaurantById).mockResolvedValue(null);

    await expect(getSelfOrderShareInfo("res_1")).rejects.toThrow(
      RESTAURANT_NOT_FOUND,
    );
  });
});

describe("geolocation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getRestaurantProfile maps latitude + longitude", async () => {
    vi.mocked(findRestaurantById).mockResolvedValue(
      makeRestaurant({ latitude: 19.076, longitude: 72.8777 }),
    );
    vi.mocked(findRestaurantImages).mockResolvedValue([]);
    vi.mocked(findRestaurantVideos).mockResolvedValue([]);

    const profile = await getRestaurantProfile("res_1");

    expect(profile.latitude).toBe(19.076);
    expect(profile.longitude).toBe(72.8777);
  });

  it("updateGeolocation persists both coordinates", async () => {
    await updateGeolocation("res_1", { latitude: 19.076, longitude: 72.8777 });

    expect(updateRestaurant).toHaveBeenCalledWith("res_1", {
      latitude: 19.076,
      longitude: 72.8777,
    });
  });

  it("clearGeolocation nulls both coordinates", async () => {
    await clearGeolocation("res_1");

    expect(updateRestaurant).toHaveBeenCalledWith("res_1", {
      latitude: null,
      longitude: null,
    });
  });
});

