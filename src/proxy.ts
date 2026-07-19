import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Routes reachable without an authenticated session (login + admin preview). */
const PUBLIC_ROUTES = ["/login", "/admin"];

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

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

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

// Run on all routes except API, Next internals, and static asset files.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
