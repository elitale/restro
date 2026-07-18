import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Restaurant } from "@/generated/prisma/client";

const { create, findUnique, findMany, count, update } = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { restaurant: { create, findUnique, findMany, count, update } },
}));

import {
  countRestaurants,
  createRestaurant,
  findRestaurantBySlug,
  findRestaurantsPaginated,
  updateRestaurantTaxProfile,
} from "./restaurant.repository";

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
});
