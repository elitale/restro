import type { NextRequest } from "next/server";
import type { z, ZodError, ZodType } from "zod";

import { apiError, apiOk, HttpError } from "@/lib/http-error";
import { toMobileHttpError } from "@/lib/mobile-api";
import { getMobileAuthOrNull } from "@/lib/mobile-auth-context";
import type { MobileTokenPayload } from "@/lib/mobile-session";

const UNAUTHORIZED = new HttpError(
  401,
  "UNAUTHORIZED",
  "Missing or invalid bearer token.",
);

const fieldErrorsFromZod = (error: ZodError): Record<string, string[]> => {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
};

// Route wrapper that requires a valid mobile bearer token before invoking the
// handler. Mirrors `withMobileJsonRoute` but exposes the parsed auth payload.
export const withMobileAuthJsonRoute = <TSchema extends ZodType, TResult>(
  schema: TSchema,
  handler: (
    auth: MobileTokenPayload,
    data: z.infer<TSchema>,
    req: NextRequest,
  ) => Promise<TResult>,
) => {
  return async (req: NextRequest): Promise<Response> => {
    const auth = await getMobileAuthOrNull(req);
    if (!auth) return apiError(UNAUTHORIZED);
    try {
      const body: unknown = await req.json().catch(() => ({}));
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return apiError(
          new HttpError(
            400,
            "INVALID_INPUT",
            "Validation failed",
            fieldErrorsFromZod(parsed.error),
          ),
        );
      }
      const result = await handler(auth, parsed.data, req);
      return apiOk(result);
    } catch (err) {
      return apiError(toMobileHttpError(err));
    }
  };
};

// GET-style wrapper: auth-required, no body validation.
export const withMobileAuthGetRoute = <TResult>(
  handler: (
    auth: MobileTokenPayload,
    req: NextRequest,
  ) => Promise<TResult>,
) => {
  return async (req: NextRequest): Promise<Response> => {
    const auth = await getMobileAuthOrNull(req);
    if (!auth) return apiError(UNAUTHORIZED);
    try {
      const result = await handler(auth, req);
      return apiOk(result);
    } catch (err) {
      return apiError(toMobileHttpError(err));
    }
  };
};
