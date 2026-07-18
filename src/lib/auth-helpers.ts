import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";

/**
 * Resolve the currently authenticated user's id from the session cookie.
 * In development, `DEV_ADMIN_USER_ID` acts as a fallback to preview gated areas.
 */
export const getCurrentUserId = async (): Promise<string | null> => {
  const session = await getSession();
  if (session) {
    return session.userId;
  }
  if (process.env.NODE_ENV !== "production" && process.env.DEV_ADMIN_USER_ID) {
    return process.env.DEV_ADMIN_USER_ID;
  }
  return null;
};

/** Guard an authenticated RSC page — redirects to /login when signed out. */
export const requireUserId = async (): Promise<string> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }
  return userId;
};
