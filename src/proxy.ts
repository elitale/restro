import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Routes reachable without an authenticated session (login + admin preview). */
const PUBLIC_ROUTES = ["/login", "/admin"];

/** Auth pages a signed-in user should be redirected away from. */
const AUTH_ROUTES = ["/login"];

/**
 * Auth.js session cookie names (non-secure in dev, `__Secure-` in prod).
 * The proxy only checks for presence — an optimistic check — and never reads
 * the database, per Next.js Proxy guidance (runs on the edge before render).
 */
const SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

const matchesRoute = (pathname: string, routes: readonly string[]): boolean =>
  routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

const hasSession = (request: NextRequest): boolean =>
  SESSION_COOKIE_NAMES.some((name) =>
    Boolean(request.cookies.get(name)?.value),
  );

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const authenticated = hasSession(request);

  // Keep signed-in managers out of the auth pages.
  if (authenticated && matchesRoute(pathname, AUTH_ROUTES)) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
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
