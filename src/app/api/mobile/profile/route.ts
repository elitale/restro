import type { NextRequest } from "next/server";

import { apiError, apiOk, HttpError } from "@/lib/http-error";
import { getMobileAuthOrNull } from "@/lib/mobile-auth-context";
import {
    getMobileUserProfile,
    MOBILE_USER_NOT_FOUND,
} from "@/services/mobile-auth.service";

const UNAUTHORIZED = new HttpError(
  401,
  "UNAUTHORIZED",
  "Missing or invalid bearer token.",
);

export const GET = async (req: NextRequest): Promise<Response> => {
  try {
    const auth = await getMobileAuthOrNull(req);
    if (!auth) return apiError(UNAUTHORIZED);
    const user = await getMobileUserProfile(auth);
    return apiOk({ user });
  } catch (err) {
    if (err instanceof Error && err.message === MOBILE_USER_NOT_FOUND) {
      return apiError(
        new HttpError(401, "UNAUTHORIZED", "Account not found or deactivated."),
      );
    }
    return apiError(err);
  }
};
