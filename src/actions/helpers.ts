import { z, type ZodError, type ZodType } from "zod";

import { getAdminContextOrNull, type AdminContext } from "@/lib/admin-auth";
import { getManagerContextOrNull, type ManagerContext } from "@/lib/manager-auth";
import { failure, success, type ActionResult } from "@/types";

const extractFieldErrors = (error: ZodError): Record<string, string[]> => {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
};

const runHandler = async <T>(
  handler: () => Promise<ActionResult<T>> | Promise<T>,
): Promise<ActionResult<T>> => {
  try {
    const result = await handler();
    if (
      result !== null &&
      typeof result === "object" &&
      "success" in result &&
      typeof (result as { success: unknown }).success === "boolean"
    ) {
      return result as ActionResult<T>;
    }
    return success(result as T);
  } catch (error) {
    return failure<T>(
      error instanceof Error ? error.message : "Something went wrong",
    );
  }
};

/** Validate input against a Zod schema, then delegate to the handler. */
export const withValidation = <TSchema extends ZodType, TOutput>(
  schema: TSchema,
  handler: (
    data: z.infer<TSchema>,
  ) => Promise<ActionResult<TOutput>> | Promise<TOutput>,
) => {
  return async (raw: unknown): Promise<ActionResult<TOutput>> => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return failure<TOutput>("Validation failed", extractFieldErrors(parsed.error));
    }
    return runHandler<TOutput>(() => handler(parsed.data));
  };
};

/** Require an admin session, validate input, then delegate to the handler. */
export const withAdminValidation = <TSchema extends ZodType, TOutput>(
  schema: TSchema,
  handler: (
    data: z.infer<TSchema>,
    ctx: AdminContext,
  ) => Promise<ActionResult<TOutput>> | Promise<TOutput>,
) => {
  return async (raw: unknown): Promise<ActionResult<TOutput>> => {
    const ctx = await getAdminContextOrNull();
    if (!ctx) {
      return failure<TOutput>("Forbidden");
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return failure<TOutput>("Validation failed", extractFieldErrors(parsed.error));
    }
    return runHandler<TOutput>(() => handler(parsed.data, ctx));
  };
};

/** Require the manager's restaurant, validate input, then delegate to the handler. */
export const withManagerValidation = <TSchema extends ZodType, TOutput>(
  schema: TSchema,
  handler: (
    data: z.infer<TSchema>,
    ctx: ManagerContext,
  ) => Promise<ActionResult<TOutput>> | Promise<TOutput>,
) => {
  return async (raw: unknown): Promise<ActionResult<TOutput>> => {
    const ctx = await getManagerContextOrNull();
    if (!ctx) {
      return failure<TOutput>("NO_RESTAURANT");
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return failure<TOutput>(
        "Validation failed",
        extractFieldErrors(parsed.error),
      );
    }
    return runHandler<TOutput>(() => handler(parsed.data, ctx));
  };
};
