import type {
  OnboardRestaurantInput,
  RestaurantListQuery,
} from "@/lib/validators/admin";
import {
  createRestaurant,
  findRestaurantBySlug,
  findRestaurantByUsername,
  findRestaurantsPaginated,
  type AdminRestaurantRow,
} from "@/repositories/restaurant.repository";
import { createUser, findUserByPhone } from "@/repositories/user.repository";
import { generateUsername } from "@/lib/username";
import type { Paginated } from "@/types";
import type { RestaurantListItemDTO } from "@/types/admin";

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const uniqueSlug = async (name: string): Promise<string> => {
  const base = slugify(name) || "restaurant";
  let slug = base;
  let attempt = 1;
  while (await findRestaurantBySlug(slug)) {
    attempt += 1;
    slug = `${base}-${attempt}`;
  }
  return slug;
};

/** Allocate a fresh, unused 7-character restaurant username. */
export const generateUniqueUsername = async (): Promise<string> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = generateUsername();
    if (!(await findRestaurantByUsername(candidate))) {
      return candidate;
    }
  }
  throw new Error("USERNAME_GENERATION_FAILED");
};

const mapRestaurant = (row: AdminRestaurantRow): RestaurantListItemDTO => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  city: row.city,
  country: row.country,
  isActive: row.isActive,
  ownerName: row.owner.name,
  ownerPhone: row.owner.phone,
  onboardedAt: row.onboardedAt.toISOString(),
});

/**
 * Onboard a restaurant: reuse the owner by phone (or create the manager
 * account), then create the restaurant with a unique slug.
 */
export const onboardRestaurant = async (
  input: OnboardRestaurantInput,
): Promise<RestaurantListItemDTO> => {
  const owner =
    (await findUserByPhone(input.ownerPhone)) ??
    (await createUser({
      phone: input.ownerPhone,
      name: input.ownerName ?? null,
    }));

  const slug = await uniqueSlug(input.name);
  const username = await generateUniqueUsername();

  const restaurant = await createRestaurant({
    name: input.name,
    slug,
    username,
    email: input.email ?? null,
    city: input.city ?? null,
    country: input.country,
    timezone: input.timezone ?? null,
    owner: { connect: { id: owner.id } },
  });

  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    city: restaurant.city,
    country: restaurant.country,
    isActive: restaurant.isActive,
    ownerName: owner.name,
    ownerPhone: owner.phone,
    onboardedAt: restaurant.onboardedAt.toISOString(),
  };
};

export const listRestaurants = async (
  query: RestaurantListQuery,
): Promise<Paginated<RestaurantListItemDTO>> => {
  const { items, total } = await findRestaurantsPaginated(query);
  return {
    items: items.map(mapRestaurant),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
};
