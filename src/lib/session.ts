import { cookies } from "next/headers";

import { jwtVerify, SignJWT } from "jose";

const COOKIE_NAME = "restro_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const getSecret = (): Uint8Array => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set.");
  }
  return new TextEncoder().encode(secret);
};

export interface SessionPayload {
  readonly userId: string;
}

/** Sign a session JWT for the user and store it in an httpOnly cookie. */
export const createSession = async (userId: string): Promise<void> => {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
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

/** Read and verify the session cookie, returning the payload or null. */
export const getSession = async (): Promise<SessionPayload | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.sub === "string" ? { userId: payload.sub } : null;
  } catch {
    return null;
  }
};

export const destroySession = async (): Promise<void> => {
  const store = await cookies();
  store.delete(COOKIE_NAME);
};
