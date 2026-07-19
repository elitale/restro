"use server";

import { withValidation } from "@/actions/helpers";
import { createGuestSession, getGuestSession } from "@/lib/guest-session";
import {
  guestPlaceOrderSchema,
  guestRequestOtpSchema,
  guestVerifyOtpSchema,
} from "@/lib/validators/guest-order";
import {
  getGuestOrders,
  placeGuestOrder,
  resolveGuestOrderTarget,
} from "@/services/guest-order.service";
import { requestGuestOtp, verifyGuestOtp } from "@/services/guest-otp.service";
import { failure, success, type ActionResult } from "@/types";
import type { GuestOrderSummaryDTO, OrderDTO } from "@/types/order";

const GUEST_NOT_VERIFIED = "GUEST_NOT_VERIFIED";

/** Send a verification code to the guest, after checking the table is valid. */
export const guestRequestOtpAction = withValidation(
  guestRequestOtpSchema,
  async (data): Promise<void> => {
    await resolveGuestOrderTarget(data.username, data.tableId);
    await requestGuestOtp(data.phone);
  },
);

/** Verify the code and open a table-scoped guest session (once per seating). */
export const guestVerifyOtpAction = withValidation(
  guestVerifyOtpSchema,
  async (data): Promise<void> => {
    const target = await resolveGuestOrderTarget(data.username, data.tableId);
    await verifyGuestOtp(data.phone, data.code);
    await createGuestSession({
      restaurantId: target.restaurantId,
      tableId: target.tableId,
      phone: data.phone,
    });
  },
);

/** Place the order — requires a verified guest session bound to this table. */
export const guestPlaceOrderAction = withValidation(
  guestPlaceOrderSchema,
  async (data): Promise<OrderDTO> => {
    const target = await resolveGuestOrderTarget(data.username, data.tableId);
    const session = await getGuestSession();
    if (
      !session ||
      session.restaurantId !== target.restaurantId ||
      session.tableId !== target.tableId
    ) {
      throw new Error(GUEST_NOT_VERIFIED);
    }
    return placeGuestOrder(
      {
        restaurantId: target.restaurantId,
        tableId: target.tableId,
        phone: session.phone,
      },
      data,
    );
  },
);

/** The verified guest's own orders (by phone + current table) with live status. */
export const guestMyOrdersAction = async (): Promise<
  ActionResult<GuestOrderSummaryDTO[]>
> => {
  const session = await getGuestSession();
  if (!session) {
    return failure<GuestOrderSummaryDTO[]>(GUEST_NOT_VERIFIED);
  }
  try {
    return success(
      await getGuestOrders(
        session.restaurantId,
        session.phone,
        session.tableId,
      ),
    );
  } catch (error) {
    return failure<GuestOrderSummaryDTO[]>(
      error instanceof Error ? error.message : "Something went wrong",
    );
  }
};
