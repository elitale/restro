import { cookies } from "next/headers";

import { jwtVerify, SignJWT } from "jose";

import type { StaffRole } from "@/types/staff";

const COOKIE_NAME = "restro_staff";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12-hour shift session

const getSecret = (): Uint8Array => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set.");
  }
  return new TextEncoder().encode(secret);
};

export interface StaffSessionPayload {
  readonly staffId: string;
  readonly restaurantId: string;
  readonly role: StaffRole;
}

/** Sign a staff session JWT and store it in an httpOnly cookie (separate from the manager's). */
export const createStaffSession = async (
  payload: StaffSessionPayload,
): Promise<void> => {
  const token = await new SignJWT({
    restaurantId: payload.restaurantId,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.staffId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
};

/** Read + verify the staff session cookie, returning its payload or null. */
export const getStaffSession = async (): Promise<StaffSessionPayload | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const { sub, restaurantId, role } = payload;
    if (
      typeof sub === "string" &&
      typeof restaurantId === "string" &&
      (role === "WAITER" || role === "KITCHEN")
    ) {
      return { staffId: sub, restaurantId, role };
    }
    return null;
  } catch {
    return null;
  }
};

export const destroyStaffSession = async (): Promise<void> => {
  const store = await cookies();
  store.delete(COOKIE_NAME);
};
