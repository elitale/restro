import type { NextRequest } from "next/server";

import { apiError, apiOk, HttpError } from "@/lib/http-error";
import { toMobileHttpError } from "@/lib/mobile-api";
import { getMobileAuthOrNull } from "@/lib/mobile-auth-context";
import {
  mobileOrderActionBodySchema,
  mobileOrderActionSchema,
} from "@/lib/validators/mobile-orders";
import { dispatchMobileOrderAction } from "@/services/mobile-orders.service";

const UNAUTHORIZED = new HttpError(
  401,
  "UNAUTHORIZED",
  "Missing or invalid bearer token.",
);

type Ctx = { params: Promise<{ orderId: string; actionId: string }> };

export const POST = async (req: NextRequest, ctx: Ctx): Promise<Response> => {
  const auth = await getMobileAuthOrNull(req);
  if (!auth) return apiError(UNAUTHORIZED);
  try {
    const { orderId, actionId } = await ctx.params;
    const parsedAction = mobileOrderActionSchema.safeParse(actionId);
    if (!parsedAction.success) {
      return apiError(
        new HttpError(400, "INVALID_ACTION", "Unknown order action."),
      );
    }
    const body: unknown = await req.json().catch(() => ({}));
    const parsedBody = mobileOrderActionBodySchema.safeParse(body);
    if (!parsedBody.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsedBody.error.issues) {
        const key = issue.path.map(String).join(".") || "form";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return apiError(
        new HttpError(400, "INVALID_INPUT", "Validation failed", fieldErrors),
      );
    }
    const order = await dispatchMobileOrderAction(
      auth,
      orderId,
      parsedAction.data,
      parsedBody.data.reason ?? null,
    );
    return apiOk({ order });
  } catch (err) {
    return apiError(toMobileHttpError(err));
  }
};
