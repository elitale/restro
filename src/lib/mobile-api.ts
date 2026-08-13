import type { NextRequest } from "next/server";
import type { z, ZodError, ZodType } from "zod";

import { apiError, apiOk, HttpError } from "@/lib/http-error";

import {
    MOBILE_MULTI_RESTAURANT_UNSUPPORTED,
    MOBILE_OTP_EXPIRED,
    MOBILE_OTP_INVALID,
    MOBILE_OTP_LOCKED,
    MOBILE_OTP_RATE_LIMITED,
    MOBILE_PIN_INVALID,
    MOBILE_PIN_LOCKED,
    MOBILE_PIN_NOT_SET,
    MOBILE_USER_NOT_FOUND,
} from "@/services/mobile-auth.service";

const fieldErrorsFromZod = (error: ZodError): Record<string, string[]> => {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
};

// Single source of truth for domain → HTTP mapping. Adding a new mobile service
// error is one entry here, not one switch per route.
const errorMap: Record<
  string,
  { status: number; code: string; message: string }
> = {
  [MOBILE_USER_NOT_FOUND]: {
    status: 404,
    code: "USER_NOT_FOUND",
    message: "No account is registered on this number.",
  },
  [MOBILE_MULTI_RESTAURANT_UNSUPPORTED]: {
    status: 409,
    code: "MULTI_RESTAURANT_UNSUPPORTED",
    message:
      "This phone works at more than one restaurant. Please contact your manager.",
  },
  [MOBILE_OTP_RATE_LIMITED]: {
    status: 429,
    code: "RATE_LIMITED",
    message: "Please wait a moment before requesting another code.",
  },
  [MOBILE_OTP_EXPIRED]: {
    status: 410,
    code: "OTP_EXPIRED",
    message: "That code expired. Send a new one.",
  },
  [MOBILE_OTP_INVALID]: {
    status: 400,
    code: "INVALID_CODE",
    message: "Wrong code. Try again.",
  },
  [MOBILE_OTP_LOCKED]: {
    status: 429,
    code: "OTP_LOCKED",
    message: "Too many attempts. Please try again later.",
  },
  [MOBILE_PIN_INVALID]: {
    status: 400,
    code: "INVALID_PIN",
    message: "Wrong PIN. Try again.",
  },
  [MOBILE_PIN_LOCKED]: {
    status: 423,
    code: "PIN_LOCKED",
    message: "PIN locked. Sign in with a code or ask your manager.",
  },
  [MOBILE_PIN_NOT_SET]: {
    status: 403,
    code: "PIN_NOT_SET",
    message: "This account has no PIN yet. Sign in with a code.",
  },
};

const toHttpError = (err: unknown): HttpError => {
  if (err instanceof HttpError) return err;
  if (err instanceof Error) {
    const entry = errorMap[err.message];
    if (entry) {
      return new HttpError(entry.status, entry.code, entry.message);
    }
  }
  return new HttpError(500, "INTERNAL", "Something went wrong.");
};

/**
 * Wrap a mobile POST endpoint: parse JSON body, validate with Zod, call the
 * handler, and translate service errors to HTTP. Keeps route files declarative.
 */
export const withMobileJsonRoute = <TSchema extends ZodType, TResult>(
  schema: TSchema,
  handler: (data: z.infer<TSchema>) => Promise<TResult>,
) => {
  return async (req: NextRequest): Promise<Response> => {
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
      const result = await handler(parsed.data);
      return apiOk(result);
    } catch (err) {
      return apiError(toHttpError(err));
    }
  };
};
