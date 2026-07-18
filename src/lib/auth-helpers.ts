/**
 * Resolve the currently authenticated user's id.
 *
 * TODO: wire this to Auth.js `auth()` once authentication is set up. Until then
 * it fails closed (returns null) so authenticated/admin routes stay locked. In
 * development, set `DEV_ADMIN_USER_ID` to a real admin user's id to preview
 * gated areas.
 */
export const getCurrentUserId = (): Promise<string | null> => {
  if (process.env.NODE_ENV !== "production" && process.env.DEV_ADMIN_USER_ID) {
    return Promise.resolve(process.env.DEV_ADMIN_USER_ID);
  }
  return Promise.resolve(null);
};
