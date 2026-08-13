import type { NextRequest } from "next/server";

import { apiError, apiNoContent, HttpError } from "@/lib/http-error";
import { getMobileAuthOrNull } from "@/lib/mobile-auth-context";

/**
 * Stateless JWTs — logout is a best-effort acknowledgement so the client can
 * clear its SecureStore even if the network flapped. Wire in a token blocklist
 * here if we ever need active revocation.
 */
export const POST = async (req: NextRequest): Promise<Response> => {
  const auth = await getMobileAuthOrNull(req);
  if (!auth) {
    return apiError(
      new HttpError(401, "UNAUTHORIZED", "Missing or invalid bearer token."),
    );
  }
  return apiNoContent();
};
