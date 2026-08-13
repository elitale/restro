import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  readMobileBearerToken,
  verifyMobileBearerToken,
} from "@/lib/mobile-session";

/** Routes reachable without an authenticated session (login + admin preview + public guest ordering). */
const PUBLIC_ROUTES = ["/login", "/admin", "/order"];

/** Auth pages a signed-in user should be redirected away from. */
const AUTH_ROUTES = ["/login"];

/**
 * Session cookie name. The proxy only checks for presence — an optimistic
 * check — and never verifies the JWT or reads the DB, per Next.js Proxy
 * guidance (it runs on the edge before render).
 */
const SESSION_COOKIE_NAMES = ["restro_session"];

/** Staff (waiter/kitchen) session cookie — gates the `/u/[username]` area. */
const STAFF_COOKIE_NAME = "restro_staff";

/** `/u/[username]/login` (exactly) — the only public page under `/u`. */
const STAFF_LOGIN_PATTERN = /^\/u\/[^/]+\/login$/;

/**
 * Mobile API paths that never require a bearer token — anything a client uses
 * to acquire one. Every other `/api/mobile/*` path must present a valid JWT.
 */
const PUBLIC_MOBILE_API_PATHS = [
  "/api/mobile/auth/request-otp",
  "/api/mobile/auth/verify-otp",
  "/api/mobile/auth/verify-pin",
];

const matchesRoute = (pathname: string, routes: readonly string[]): boolean =>
  routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

const hasSession = (request: NextRequest): boolean =>
  SESSION_COOKIE_NAMES.some((name) =>
    Boolean(request.cookies.get(name)?.value),
  );

const hasStaffSession = (request: NextRequest): boolean =>
  Boolean(request.cookies.get(STAFF_COOKIE_NAME)?.value);

const mobileUnauthorized = (): NextResponse =>
  NextResponse.json(
    { error: "Missing or invalid bearer token.", code: "UNAUTHORIZED" },
    { status: 401 },
  );

/**
 * Verify `Authorization: Bearer <jwt>` for a protected mobile API path. jose
 * runs at the edge, so we can do full signature verification here (no DB) and
 * short-circuit unauthenticated requests before they reach any handler.
 */
const handleMobileApi = async (request: NextRequest): Promise<NextResponse> => {
  if (PUBLIC_MOBILE_API_PATHS.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  const token = readMobileBearerToken(request.headers);
  if (!token) return mobileUnauthorized();
  const payload = await verifyMobileBearerToken(token);
  if (!payload) return mobileUnauthorized();
  return NextResponse.next();
};

/**
 * Route the restaurant-scoped staff area (`/u/[username]/…`) on its own staff
 * session, independent of the manager session. The login page is public; every
 * other `/u` page needs a staff cookie.
 */
const handleStaffArea = (request: NextRequest): NextResponse => {
  const { pathname } = request.nextUrl;
  const username = pathname.split("/")[2] ?? "";
  const staffAuthed = hasStaffSession(request);

  if (STAFF_LOGIN_PATTERN.test(pathname)) {
    return staffAuthed
      ? NextResponse.redirect(new URL(`/u/${username}`, request.nextUrl))
      : NextResponse.next();
  }
  return staffAuthed
    ? NextResponse.next()
    : NextResponse.redirect(new URL(`/u/${username}/login`, request.nextUrl));
};

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Mobile API auth — Bearer JWT gate; public endpoints (login) allow-listed.
  if (pathname.startsWith("/api/mobile/")) {
    return handleMobileApi(request);
  }

  // The staff area runs on its own session, gated separately from the manager.
  if (pathname.startsWith("/u/")) {
    return handleStaffArea(request);
  }

  const authenticated = hasSession(request);

  // Keep signed-in managers out of the auth pages.
  if (authenticated && matchesRoute(pathname, AUTH_ROUTES)) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
  }

  // Non-public routes require a session — default redirect to /login.
  if (!authenticated && !matchesRoute(pathname, PUBLIC_ROUTES)) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Run on pages + mobile API. Other `/api/*` routes are excluded from proxy.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\..*).*)",
    "/api/mobile/:path*",
  ],
};
