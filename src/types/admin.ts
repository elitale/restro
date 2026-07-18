import type { UserRole } from "@/generated/prisma/client";

export type AdminUserStatus = "active" | "suspended" | "deleted";

export interface AdminUserListItemDTO {
  readonly id: string;
  readonly name: string | null;
  readonly phone: string;
  readonly email: string | null;
  readonly role: UserRole;
  readonly status: AdminUserStatus;
  readonly restaurantCount: number;
  readonly createdAt: string;
}

export interface RestaurantListItemDTO {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly city: string | null;
  readonly country: string;
  readonly isActive: boolean;
  readonly ownerName: string | null;
  readonly ownerPhone: string;
  readonly onboardedAt: string;
}
