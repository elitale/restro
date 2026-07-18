import type { Prisma, User, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { UserListQuery } from "@/lib/validators/admin";

export const createUser = (data: Prisma.UserCreateInput): Promise<User> =>
  prisma.user.create({ data });

export const findUserById = (id: string): Promise<User | null> =>
  prisma.user.findUnique({ where: { id } });

export const findUserByPhone = (phone: string): Promise<User | null> =>
  prisma.user.findUnique({ where: { phone } });

export const findUserByEmail = (email: string): Promise<User | null> =>
  prisma.user.findUnique({ where: { email } });

export const updateUser = (
  id: string,
  data: Prisma.UserUpdateInput,
): Promise<User> => prisma.user.update({ where: { id }, data });

export const setUserPin = (id: string, pinHash: string): Promise<User> =>
  prisma.user.update({
    where: { id },
    data: {
      pinHash,
      pinUpdatedAt: new Date(),
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    },
  });

export const clearUserPin = (id: string): Promise<User> =>
  prisma.user.update({
    where: { id },
    data: {
      pinHash: null,
      pinUpdatedAt: null,
      pinFailedAttempts: 0,
      pinLockedUntil: null,
    },
  });

export const recordPinFailure = (
  id: string,
  data: { failedAttempts: number; lockedUntil: Date | null },
): Promise<User> =>
  prisma.user.update({
    where: { id },
    data: {
      pinFailedAttempts: data.failedAttempts,
      pinLockedUntil: data.lockedUntil,
    },
  });

export const resetPinCounters = (id: string): Promise<User> =>
  prisma.user.update({
    where: { id },
    data: { pinFailedAttempts: 0, pinLockedUntil: null },
  });

export interface UserAuthState {
  readonly role: UserRole;
  readonly suspendedAt: Date | null;
  readonly deletedAt: Date | null;
}

export const getUserAuthState = (id: string): Promise<UserAuthState | null> =>
  prisma.user.findUnique({
    where: { id },
    select: { role: true, suspendedAt: true, deletedAt: true },
  });

const USER_LIST_SELECT = {
  id: true,
  name: true,
  phone: true,
  email: true,
  role: true,
  suspendedAt: true,
  deletedAt: true,
  createdAt: true,
  _count: { select: { ownedRestaurants: true } },
} satisfies Prisma.UserSelect;

export type AdminUserRow = Prisma.UserGetPayload<{
  select: typeof USER_LIST_SELECT;
}>;

const userListWhere = (query: UserListQuery): Prisma.UserWhereInput => ({
  ...(query.role ? { role: query.role } : {}),
  ...(query.search
    ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { phone: { contains: query.search, mode: "insensitive" } },
          { email: { contains: query.search, mode: "insensitive" } },
        ],
      }
    : {}),
});

export const findUsersPaginated = async (
  query: UserListQuery,
): Promise<{ items: AdminUserRow[]; total: number }> => {
  const where = userListWhere(query);
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: USER_LIST_SELECT,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total };
};
