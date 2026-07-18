import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Restaurant, User } from "@/generated/prisma/client";
import type { AdminRestaurantRow } from "@/repositories/restaurant.repository";

vi.mock("@/repositories/restaurant.repository", () => ({
  createRestaurant: vi.fn(),
  findRestaurantBySlug: vi.fn(),
  findRestaurantByUsername: vi.fn(),
  findRestaurantsPaginated: vi.fn(),
}));
vi.mock("@/repositories/user.repository", () => ({
  createUser: vi.fn(),
  findUserByPhone: vi.fn(),
}));

import {
  createRestaurant,
  findRestaurantBySlug,
  findRestaurantByUsername,
  findRestaurantsPaginated,
} from "@/repositories/restaurant.repository";
import { createUser, findUserByPhone } from "@/repositories/user.repository";
import {
  generateUniqueUsername,
  listRestaurants,
  onboardRestaurant,
} from "./restaurant.service";

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: "usr_1",
  phone: "+919876543210",
  phoneVerifiedAt: null,
  email: null,
  emailVerifiedAt: null,
  name: "Asha",
  role: "MANAGER",
  isActive: true,
  suspendedAt: null,
  deletedAt: null,
  pinHash: null,
  pinUpdatedAt: null,
  pinFailedAttempts: 0,
  pinLockedUntil: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

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
  onboardedAt: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
  ownerId: "usr_1",
  ...overrides,
});

describe("onboardRestaurant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses an existing owner and creates a restaurant with a slug", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(makeUser());
    vi.mocked(findRestaurantBySlug).mockResolvedValue(null);
    vi.mocked(findRestaurantByUsername).mockResolvedValue(null);
    vi.mocked(createRestaurant).mockResolvedValue(makeRestaurant());

    const result = await onboardRestaurant({
      name: "Spice Route",
      ownerPhone: "+919876543210",
      country: "IN",
    });

    expect(createUser).not.toHaveBeenCalled();
    expect(createRestaurant).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Spice Route",
        slug: "spice-route",
        owner: { connect: { id: "usr_1" } },
      }),
    );
    expect(result.slug).toBe("spice-route");
    expect(result.ownerPhone).toBe("+919876543210");
  });

  it("creates the owner when the phone is new", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(null);
    vi.mocked(createUser).mockResolvedValue(
      makeUser({ id: "usr_new", name: "Ravi" }),
    );
    vi.mocked(findRestaurantBySlug).mockResolvedValue(null);
    vi.mocked(findRestaurantByUsername).mockResolvedValue(null);
    vi.mocked(createRestaurant).mockResolvedValue(
      makeRestaurant({ ownerId: "usr_new" }),
    );

    await onboardRestaurant({
      name: "Spice Route",
      ownerPhone: "+919999999999",
      ownerName: "Ravi",
      country: "IN",
    });

    expect(createUser).toHaveBeenCalledWith({
      phone: "+919999999999",
      name: "Ravi",
    });
    expect(createRestaurant).toHaveBeenCalledWith(
      expect.objectContaining({ owner: { connect: { id: "usr_new" } } }),
    );
  });

  it("appends a suffix when the slug is taken", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(makeUser());
    vi.mocked(findRestaurantBySlug)
      .mockResolvedValueOnce(makeRestaurant())
      .mockResolvedValueOnce(null);
    vi.mocked(createRestaurant).mockResolvedValue(
      makeRestaurant({ slug: "spice-route-2" }),
    );

    await onboardRestaurant({
      name: "Spice Route",
      ownerPhone: "+919876543210",
      country: "IN",
    });

    expect(createRestaurant).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "spice-route-2" }),
    );
  });
});

describe("listRestaurants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps rows to DTOs", async () => {
    const row: AdminRestaurantRow = {
      id: "res_1",
      name: "Spice Route",
      slug: "spice-route",
      city: null,
      country: "IN",
      isActive: true,
      onboardedAt: new Date("2026-01-01T00:00:00.000Z"),
      owner: { name: "Asha", phone: "+919876543210" },
    };
    vi.mocked(findRestaurantsPaginated).mockResolvedValue({
      items: [row],
      total: 1,
    });

    const result = await listRestaurants({ page: 1, pageSize: 20 });

    expect(result.items[0]).toEqual({
      id: "res_1",
      name: "Spice Route",
      slug: "spice-route",
      city: null,
      country: "IN",
      isActive: true,
      ownerName: "Asha",
      ownerPhone: "+919876543210",
      onboardedAt: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("generateUniqueUsername", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a 7-char candidate that isn't already taken", async () => {
    vi.mocked(findRestaurantByUsername).mockResolvedValue(null);

    const username = await generateUniqueUsername();

    expect(username).toMatch(/^[a-z0-9]{7}$/);
    expect(findRestaurantByUsername).toHaveBeenCalledWith(username);
  });

  it("retries until it finds a free username", async () => {
    vi.mocked(findRestaurantByUsername)
      .mockResolvedValueOnce(makeRestaurant())
      .mockResolvedValueOnce(null);

    await generateUniqueUsername();

    expect(findRestaurantByUsername).toHaveBeenCalledTimes(2);
  });
});
