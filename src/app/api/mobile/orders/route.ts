import {
  withMobileAuthGetRoute,
  withMobileAuthJsonRoute,
} from "@/lib/mobile-authed-api";
import { mobileCreateOrderSchema } from "@/lib/validators/mobile-orders";
import {
  createMobileOrder,
  listMobileOrders,
} from "@/services/mobile-orders.service";

export const GET = withMobileAuthGetRoute(async (auth, req) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const scope =
    status === "settled" || status === "all" || status === "live"
      ? status
      : "live";
  return listMobileOrders(auth, { status: scope });
});

export const POST = withMobileAuthJsonRoute(
  mobileCreateOrderSchema,
  async (auth, input) => {
    const order = await createMobileOrder(auth, input);
    return { order };
  },
);
