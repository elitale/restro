import { findUsersPaginated, type AdminUserRow } from "@/repositories/user.repository";
import type { UserListQuery } from "@/lib/validators/admin";
import type { Paginated } from "@/types";
import type { AdminUserListItemDTO, AdminUserStatus } from "@/types/admin";

const statusOf = (row: {
  suspendedAt: Date | null;
  deletedAt: Date | null;
}): AdminUserStatus => {
  if (row.deletedAt) {
    return "deleted";
  }
  if (row.suspendedAt) {
    return "suspended";
  }
  return "active";
};

const mapUser = (row: AdminUserRow): AdminUserListItemDTO => ({
  id: row.id,
  name: row.name,
  phone: row.phone,
  email: row.email,
  role: row.role,
  status: statusOf(row),
  restaurantCount: row._count.ownedRestaurants,
  createdAt: row.createdAt.toISOString(),
});

export const listUsers = async (
  query: UserListQuery,
): Promise<Paginated<AdminUserListItemDTO>> => {
  const { items, total } = await findUsersPaginated(query);
  return {
    items: items.map(mapUser),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
};
