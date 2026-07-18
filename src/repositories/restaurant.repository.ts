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
