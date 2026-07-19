import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrderDTO } from "@/types/order";

vi.mock("@/lib/admin-auth", () => ({ getAdminContextOrNull: vi.fn() }));
vi.mock("@/lib/manager-auth", () => ({ getManagerContextOrNull: vi.fn() }));
vi.mock("@/lib/staff-auth", () => ({ getStaffContextOrNull: vi.fn() }));
vi.mock("@/lib/guest-session", () => ({
  createGuestSession: vi.fn(),
  destroyGuestSession: vi.fn(),
  getGuestSession: vi.fn(),
}));
vi.mock("@/services/guest-otp.service", () => ({
  requestGuestOtp: vi.fn(),
  verifyGuestOtp: vi.fn(),
}));
vi.mock("@/services/guest-order.service", () => ({
  resolveGuestOrderTarget: vi.fn(),
  placeGuestOrder: vi.fn(),
  getGuestOrders: vi.fn(),
}));

import {
  createGuestSession,
  destroyGuestSession,
  getGuestSession,
} from "@/lib/guest-session";
import {
  getGuestOrders,
  placeGuestOrder,
  resolveGuestOrderTarget,
} from "@/services/guest-order.service";
import { requestGuestOtp, verifyGuestOtp } from "@/services/guest-otp.service";
import {
  guestLogoutAction,
  guestMyOrdersAction,
  guestPlaceOrderAction,
  guestRequestOtpAction,
  guestVerifyOtpAction,
} from "./guest-order.actions";

const TARGET = { restaurantId: "res_1", tableId: "t1", tableLabel: "T1" };
const PHONE = "+919876543210";
const base = { username: "elitale", tableId: "t1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveGuestOrderTarget).mockResolvedValue(TARGET);
});

describe("guestRequestOtpAction", () => {
  it("validates the table then sends the code", async () => {
    const result = await guestRequestOtpAction({ ...base, phone: PHONE });

    expect(result.success).toBe(true);
    expect(resolveGuestOrderTarget).toHaveBeenCalledWith("elitale", "t1");
    expect(requestGuestOtp).toHaveBeenCalledWith(PHONE);
  });

  it("rejects an invalid phone with field errors", async () => {
    const result = await guestRequestOtpAction({ ...base, phone: "nope" });

    expect(result.success).toBe(false);
    expect(requestGuestOtp).not.toHaveBeenCalled();
  });
});

describe("guestVerifyOtpAction", () => {
  it("verifies then opens a table-scoped guest session", async () => {
    const result = await guestVerifyOtpAction({
      ...base,
      phone: PHONE,
      code: "123456",
    });

    expect(result.success).toBe(true);
    expect(verifyGuestOtp).toHaveBeenCalledWith(PHONE, "123456");
    expect(createGuestSession).toHaveBeenCalledWith({
      restaurantId: "res_1",
      tableId: "t1",
      phone: PHONE,
    });
  });
});

describe("guestPlaceOrderAction", () => {
  const input = {
    ...base,
    idempotencyKey: "abcd1234",
    items: [{ menuItemId: "i1", quantity: 1 }],
  };

  it("places the order when a matching guest session exists", async () => {
    vi.mocked(getGuestSession).mockResolvedValue({
      restaurantId: "res_1",
      tableId: "t1",
      phone: PHONE,
      expiresAt: Date.now() + 3_600_000,
    });
    vi.mocked(placeGuestOrder).mockResolvedValue({ id: "o1" } as OrderDTO);

    const result = await guestPlaceOrderAction(input);

    expect(result.success).toBe(true);
    expect(placeGuestOrder).toHaveBeenCalledWith(
      { restaurantId: "res_1", tableId: "t1", phone: PHONE },
      expect.objectContaining({ idempotencyKey: "abcd1234" }),
    );
  });

  it("fails when there is no verified guest session", async () => {
    vi.mocked(getGuestSession).mockResolvedValue(null);

    const result = await guestPlaceOrderAction(input);

    expect(result.success).toBe(false);
    expect(placeGuestOrder).not.toHaveBeenCalled();
  });

  it("fails when the session is for a different table", async () => {
    vi.mocked(getGuestSession).mockResolvedValue({
      restaurantId: "res_1",
      tableId: "OTHER",
      phone: PHONE,
      expiresAt: Date.now() + 3_600_000,
    });

    const result = await guestPlaceOrderAction(input);

    expect(result.success).toBe(false);
    expect(placeGuestOrder).not.toHaveBeenCalled();
  });
});

describe("guestMyOrdersAction", () => {
  it("returns the guest's orders from the cookie session", async () => {
    vi.mocked(getGuestSession).mockResolvedValue({
      restaurantId: "res_1",
      tableId: "t1",
      phone: PHONE,
      expiresAt: Date.now() + 3_600_000,
    });
    vi.mocked(getGuestOrders).mockResolvedValue([]);

    const result = await guestMyOrdersAction();

    expect(result.success).toBe(true);
    expect(getGuestOrders).toHaveBeenCalledWith("res_1", PHONE, "t1");
  });

  it("fails without a verified guest session", async () => {
    vi.mocked(getGuestSession).mockResolvedValue(null);

    const result = await guestMyOrdersAction();

    expect(result.success).toBe(false);
    expect(getGuestOrders).not.toHaveBeenCalled();
  });
});

describe("guestLogoutAction", () => {
  it("clears the guest session cookie", async () => {
    await guestLogoutAction();

    expect(destroyGuestSession).toHaveBeenCalled();
  });
});
