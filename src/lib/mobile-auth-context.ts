import type { NextRequest } from "next/server";

import {
    readMobileBearerToken,
    verifyMobileBearerToken,
    type MobileTokenPayload,
} from "@/lib/mobile-session";

/**
 * Extract and verify the mobile bearer token on any Request-shaped object.
 * Returns the token payload or null if the header is missing / malformed /
 * signature-invalid. Route handlers use this instead of duplicating the
 * header-parse + JWT-verify dance.
 */
export const getMobileAuthOrNull = async (
  req: Request | NextRequest,
): Promise<MobileTokenPayload | null> => {
  const token = readMobileBearerToken(req.headers);
  if (!token) return null;
  return verifyMobileBearerToken(token);
};
