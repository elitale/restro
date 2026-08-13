import { jwtVerify, SignJWT } from "jose";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const KINDS = ["manager", "staff"] as const;
export type MobileTokenKind = (typeof KINDS)[number];

const ROLES = [
  "MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
  "WAITER",
  "KITCHEN",
  "MANAGEMENT",
] as const;
export type MobileTokenRole = (typeof ROLES)[number];

export interface MobileTokenPayload {
  readonly subjectId: string;
  readonly kind: MobileTokenKind;
  readonly restaurantId: string | null;
  readonly role: MobileTokenRole;
}

const getSecret = (): Uint8Array => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set.");
  }
  return new TextEncoder().encode(secret);
};

const isKind = (v: unknown): v is MobileTokenKind =>
  typeof v === "string" && (KINDS as readonly string[]).includes(v);

const isRole = (v: unknown): v is MobileTokenRole =>
  typeof v === "string" && (ROLES as readonly string[]).includes(v);

/** Sign a bearer JWT for a signed-in mobile client (no cookies). */
export const issueMobileBearerToken = async (
  payload: MobileTokenPayload,
): Promise<string> =>
  new SignJWT({
    kind: payload.kind,
    restaurantId: payload.restaurantId,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.subjectId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());

/** Verify a bearer token and return its payload; returns null when invalid. */
export const verifyMobileBearerToken = async (
  token: string,
): Promise<MobileTokenPayload | null> => {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const { sub, kind, restaurantId, role } = payload;
    if (
      typeof sub === "string" &&
      isKind(kind) &&
      isRole(role) &&
      (restaurantId === null || typeof restaurantId === "string")
    ) {
      return { subjectId: sub, kind, role, restaurantId: restaurantId ?? null };
    }
    return null;
  } catch {
    return null;
  }
};

/** Extract a bearer token from an `Authorization: Bearer <token>` header. */
export const readMobileBearerToken = (headers: Headers): string | null => {
  const header = headers.get("authorization") ?? headers.get("Authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ", 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim() || null;
};

export const MOBILE_TOKEN_MAX_AGE_SECONDS = MAX_AGE_SECONDS;
