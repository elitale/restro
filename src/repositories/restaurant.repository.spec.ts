import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Restaurant } from "@/generated/prisma/client";

const {
  create,
  findUnique,
  findMany,
  count,
  update,
  imageCreate,
  imageDelete,
  videoCreate,
  videoDelete,
} = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  imageCreate: vi.fn(),
  imageDelete: vi.fn(),
  videoCreate: vi.fn(),
  videoDelete: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    restaurant: { create, findUnique, findMany, count, update },
    restaurantImage: { create: imageCreate, delete: imageDelete },
    restaurantVideo: { create: videoCreate, delete: videoDelete },
  },
}));

import {
  countRestaurants,
  createRestaurant,
  createRestaurantImage,
  createRestaurantVideo,
  deleteRestaurantImage,
  deleteRestaurantVideo,
  findRestaurantBySlug,
  findRestaurantByUsername,
  findRestaurantsPaginated,
  updateRestaurant,
  updateRestaurantTaxProfile,
} from "./restaurant.repository";

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
  onboardedAt: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
  ownerId: "usr_1",
  ...overrides,
});

describe("restaurantRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createRestaurant forwards data", async () => {
    const restaurant = makeRestaurant();
    create.mockResolvedValue(restaurant);

    const result = await createRestaurant({
      name: "Spice Route",
      slug: "spice-route",
      country: "IN",
      owner: { connect: { id: "usr_1" } },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        name: "Spice Route",
        slug: "spice-route",
        country: "IN",
        owner: { connect: { id: "usr_1" } },
      },
    });
    expect(result).toBe(restaurant);
  });

  it("findRestaurantBySlug queries by slug", async () => {
    findUnique.mockResolvedValue(null);

    await findRestaurantBySlug("spice-route");

    expect(findUnique).toHaveBeenCalledWith({ where: { slug: "spice-route" } });
  });

  it("findRestaurantByUsername queries by username", async () => {
    findUnique.mockResolvedValue(null);

    await findRestaurantByUsername("tasty1");

    expect(findUnique).toHaveBeenCalledWith({ where: { username: "tasty1" } });
  });

  it("findRestaurantsPaginated excludes deleted and paginates", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    const result = await findRestaurantsPaginated({ page: 1, pageSize: 20 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        orderBy: { onboardedAt: "desc" },
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
    expect(result).toEqual({ items: [], total: 0 });
  });

  it("countRestaurants counts non-deleted", async () => {
    count.mockResolvedValue(5);

    const result = await countRestaurants();

    expect(count).toHaveBeenCalledWith({ where: { deletedAt: null } });
    expect(result).toBe(5);
  });

  it("updateRestaurantTaxProfile writes the tax fields by id", async () => {
    update.mockResolvedValue({});

    await updateRestaurantTaxProfile("res_1", {
      gstRegistrationType: "REGULAR",
      serviceGstRate: 5,
      pricesTaxInclusive: false,
      gstin: null,
      sacCode: "996331",
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: "res_1" },
      data: expect.objectContaining({
        gstRegistrationType: "REGULAR",
        serviceGstRate: 5,
      }),
    });
  });

  it("updateRestaurant writes profile fields by id", async () => {
    update.mockResolvedValue({});

    await updateRestaurant("res_1", { legalName: "Acme Pvt Ltd" });

    expect(update).toHaveBeenCalledWith({
      where: { id: "res_1" },
      data: { legalName: "Acme Pvt Ltd" },
    });
  });

  it("createRestaurantImage connects the restaurant", async () => {
    imageCreate.mockResolvedValue({ id: "gi1" });

    await createRestaurantImage({
      restaurantId: "res_1",
      url: "https://cdn.test/g",
      storageKey: "restaurants/res_1/gallery-x.webp",
      sortOrder: 0,
    });

    expect(imageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        restaurant: { connect: { id: "res_1" } },
        storageKey: "restaurants/res_1/gallery-x.webp",
      }),
    });
  });

  it("deleteRestaurantImage deletes by id", async () => {
    imageDelete.mockResolvedValue({});

    await deleteRestaurantImage("gi1");

    expect(imageDelete).toHaveBeenCalledWith({ where: { id: "gi1" } });
  });

  it("createRestaurantVideo connects the restaurant", async () => {
    videoCreate.mockResolvedValue({ id: "v1" });

    await createRestaurantVideo({
      restaurantId: "res_1",
      kind: "LINK",
      url: "https://youtu.be/abc",
      storageKey: null,
      caption: null,
      sortOrder: 0,
    });

    expect(videoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        restaurant: { connect: { id: "res_1" } },
        kind: "LINK",
        url: "https://youtu.be/abc",
      }),
    });
  });

  it("deleteRestaurantVideo deletes by id", async () => {
    videoDelete.mockResolvedValue({});

    await deleteRestaurantVideo("v1");

    expect(videoDelete).toHaveBeenCalledWith({ where: { id: "v1" } });
  });
});
