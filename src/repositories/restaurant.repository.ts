import type { Prisma, Restaurant } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { RestaurantListQuery } from "@/lib/validators/admin";

export const createRestaurant = (
  data: Prisma.RestaurantCreateInput,
): Promise<Restaurant> => prisma.restaurant.create({ data });

export const findRestaurantBySlug = (
  slug: string,
): Promise<Restaurant | null> =>
  prisma.restaurant.findUnique({ where: { slug } });

export const findRestaurantByUsername = (
  username: string,
): Promise<Restaurant | null> =>
  prisma.restaurant.findUnique({ where: { username } });

export const findRestaurantById = (id: string): Promise<Restaurant | null> =>
  prisma.restaurant.findUnique({ where: { id } });

/** The manager's primary (oldest active) restaurant — v1 is single-outlet. */
export const findFirstRestaurantByOwner = (
  ownerId: string,
): Promise<Restaurant | null> =>
  prisma.restaurant.findFirst({
    where: { ownerId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

export interface TaxProfileWriteData {
  gstRegistrationType: "REGULAR" | "COMPOSITION" | "UNREGISTERED";
  serviceGstRate: number | null;
  pricesTaxInclusive: boolean;
  gstin: string | null;
  sacCode: string | null;
}

export const updateRestaurantTaxProfile = (
  id: string,
  data: TaxProfileWriteData,
): Promise<Restaurant> =>
  prisma.restaurant.update({ where: { id }, data });

/** Generic profile/branding update (Restaurant columns). */
export const updateRestaurant = (
  id: string,
  data: Prisma.RestaurantUpdateInput,
): Promise<Restaurant> => prisma.restaurant.update({ where: { id }, data });

export interface RestaurantImageWriteData {
  restaurantId: string;
  url: string;
  storageKey: string;
  sortOrder: number;
}

export const createRestaurantImage = (data: RestaurantImageWriteData) =>
  prisma.restaurantImage.create({
    data: {
      restaurant: { connect: { id: data.restaurantId } },
      url: data.url,
      storageKey: data.storageKey,
      sortOrder: data.sortOrder,
    },
  });

export const findRestaurantImageById = (id: string) =>
  prisma.restaurantImage.findUnique({ where: { id } });

export const findRestaurantImages = (restaurantId: string) =>
  prisma.restaurantImage.findMany({
    where: { restaurantId },
    orderBy: { sortOrder: "asc" },
  });

export const countRestaurantImages = (restaurantId: string): Promise<number> =>
  prisma.restaurantImage.count({ where: { restaurantId } });

export const deleteRestaurantImage = (id: string) =>
  prisma.restaurantImage.delete({ where: { id } });

export interface RestaurantVideoWriteData {
  restaurantId: string;
  kind: "LINK" | "FILE";
  url: string;
  storageKey: string | null;
  caption: string | null;
  sortOrder: number;
}

export const createRestaurantVideo = (data: RestaurantVideoWriteData) =>
  prisma.restaurantVideo.create({
    data: {
      restaurant: { connect: { id: data.restaurantId } },
      kind: data.kind,
      url: data.url,
      storageKey: data.storageKey,
      caption: data.caption,
      sortOrder: data.sortOrder,
    },
  });

export const findRestaurantVideos = (restaurantId: string) =>
  prisma.restaurantVideo.findMany({
    where: { restaurantId },
    orderBy: { sortOrder: "asc" },
  });

export const findRestaurantVideoById = (id: string) =>
  prisma.restaurantVideo.findUnique({ where: { id } });

export const countRestaurantVideos = (restaurantId: string): Promise<number> =>
  prisma.restaurantVideo.count({ where: { restaurantId } });

export const deleteRestaurantVideo = (id: string) =>
  prisma.restaurantVideo.delete({ where: { id } });

const RESTAURANT_LIST_SELECT = {
  id: true,
  name: true,
  slug: true,
  city: true,
  country: true,
  isActive: true,
  onboardedAt: true,
  owner: { select: { name: true, phone: true } },
} satisfies Prisma.RestaurantSelect;

export type AdminRestaurantRow = Prisma.RestaurantGetPayload<{
  select: typeof RESTAURANT_LIST_SELECT;
}>;

const restaurantListWhere = (
  query: RestaurantListQuery,
): Prisma.RestaurantWhereInput => ({
  deletedAt: null,
  ...(query.search
    ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { city: { contains: query.search, mode: "insensitive" } },
        ],
      }
    : {}),
});

export const findRestaurantsPaginated = async (
  query: RestaurantListQuery,
): Promise<{ items: AdminRestaurantRow[]; total: number }> => {
  const where = restaurantListWhere(query);
  const [items, total] = await Promise.all([
    prisma.restaurant.findMany({
      where,
      select: RESTAURANT_LIST_SELECT,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { onboardedAt: "desc" },
    }),
    prisma.restaurant.count({ where }),
  ]);
  return { items, total };
};

export const countRestaurants = (): Promise<number> =>
  prisma.restaurant.count({ where: { deletedAt: null } });
