import type { NextRequest } from "next/server";

import { apiError, apiOk, HttpError } from "@/lib/http-error";
import { toMobileHttpError } from "@/lib/mobile-api";
import { getMobileAuthOrNull } from "@/lib/mobile-auth-context";
import { mobileEditOrderSchema } from "@/lib/validators/mobile-orders";
import {
    editMobileOrder,
    getMobileOrder,
} from "@/services/mobile-orders.service";

const UNAUTHORIZED = new HttpError(
  401,
  "UNAUTHORIZED",
  "Missing or invalid bearer token.",
);

type Ctx = { params: Promise<{ orderId: string }> };

export const GET = async (req: NextRequest, ctx: Ctx): Promise<Response> => {
  const auth = await getMobileAuthOrNull(req);
  if (!auth) return apiError(UNAUTHORIZED);
  try {
    const { orderId } = await ctx.params;
    const order = await getMobileOrder(auth, orderId);
    return apiOk({ order });
  } catch (err) {
    return apiError(toMobileHttpError(err));
  }
};

export const PATCH = async (req: NextRequest, ctx: Ctx): Promise<Response> => {
  const auth = await getMobileAuthOrNull(req);
  if (!auth) return apiError(UNAUTHORIZED);
  try {
    const { orderId } = await ctx.params;
    const body: unknown = await req.json().catch(() => ({}));
    const parsed = mobileEditOrderSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".") || "form";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return apiError(
        new HttpError(400, "INVALID_INPUT", "Validation failed", fieldErrors),
      );
    }
    const order = await editMobileOrder(auth, orderId, parsed.data);
    return apiOk({ order });
  } catch (err) {
    return apiError(toMobileHttpError(err));
  }
};
