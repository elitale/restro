import { notFound } from "next/navigation";

import type { UserRole } from "@/generated/prisma/client";
import { getUserAuthState } from "@/repositories/user.repository";

import { getCurrentUserId } from "./auth-helpers";

export interface AdminContext {
  readonly userId: string;
  readonly role: UserRole;
}

export const isAdminRole = (role: UserRole): boolean =>
  role === "ADMIN" || role === "SUPER_ADMIN";

export const isSuperAdmin = (role: UserRole): boolean => role === "SUPER_ADMIN";

/**
 * DB-backed admin check (role read fresh on every call, so a stale session
 * can never keep admin access after a demotion/suspension/deletion).
 */
export const getAdminContextOrNull = async (): Promise<AdminContext | null> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return null;
  }

  const state = await getUserAuthState(userId);
  if (!state || state.deletedAt || state.suspendedAt) {
    return null;
  }
  if (!isAdminRole(state.role)) {
    return null;
  }

  return { userId, role: state.role };
};

/** Guard an admin RSC page/layout — 404s (no route leak) for non-admins. */
export const requireAdminPage = async (): Promise<AdminContext> => {
  const ctx = await getAdminContextOrNull();
  if (!ctx) {
    notFound();
  }
  return ctx;
};

export const requireSuperAdminPage = async (): Promise<AdminContext> => {
  const ctx = await getAdminContextOrNull();
  if (!ctx || !isSuperAdmin(ctx.role)) {
    notFound();
  }
  return ctx;
};
