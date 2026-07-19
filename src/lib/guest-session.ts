import { cookies } from "next/headers";

import { jwtVerify, SignJWT } from "jose";

const COOKIE_NAME = "restro_guest";
const MAX_AGE_SECONDS = 60 * 60 * 3; // ~one seating

const getSecret = (): Uint8Array => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set.");
  }
  return new TextEncoder().encode(secret);
};

/** A verified guest, bound to one restaurant + table for the seating. */
export interface GuestSessionPayload {
  readonly restaurantId: string;
  readonly tableId: string;
  readonly phone: string;
}

/** Sign a guest session JWT and store it in an httpOnly cookie. */
export const createGuestSession = async (
  payload: GuestSessionPayload,
): Promise<void> => {
  const token = await new SignJWT({
    restaurantId: payload.restaurantId,
    tableId: payload.tableId,
    phone: payload.phone,
  })
    .setProtectedHeader({ alg: "HS256" })
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

/** Read + verify the guest session cookie, returning its payload or null. */
export const getGuestSession =
  async (): Promise<GuestSessionPayload | null> => {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) {
      return null;
    }
    try {
      const { payload } = await jwtVerify(token, getSecret());
      const { restaurantId, tableId, phone } = payload;
      if (
        typeof restaurantId === "string" &&
        typeof tableId === "string" &&
        typeof phone === "string"
      ) {
        return { restaurantId, tableId, phone };
      }
      return null;
    } catch {
      return null;
    }
  };

export const destroyGuestSession = async (): Promise<void> => {
  const store = await cookies();
  store.delete(COOKIE_NAME);
};
