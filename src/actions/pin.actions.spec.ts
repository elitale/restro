import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({ getAdminContextOrNull: vi.fn() }));
vi.mock("@/lib/manager-auth", () => ({ getManagerContextOrNull: vi.fn() }));
vi.mock("@/lib/auth-helpers", () => ({ getCurrentUserId: vi.fn() }));
vi.mock("@/lib/session", () => ({ createSession: vi.fn() }));
vi.mock("@/services/auth.service", () => ({ startLogin: vi.fn() }));
vi.mock("@/services/pin-auth.service", () => ({
  removeManagerPin: vi.fn(),
  setManagerPin: vi.fn(),
  verifyPinLogin: vi.fn(),
}));

import { getCurrentUserId } from "@/lib/auth-helpers";
import { createSession } from "@/lib/session";
import { startLogin } from "@/services/auth.service";
import {
  removeManagerPin,
  setManagerPin,
  verifyPinLogin,
} from "@/services/pin-auth.service";
import {
  removePinAction,
  setPinAction,
  startLoginAction,
  verifyPinAction,
} from "./pin.actions";

const PHONE = "+919876543210";

describe("startLoginAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the resolved method", async () => {
    vi.mocked(startLogin).mockResolvedValue("pin");

    const result = await startLoginAction({ phone: PHONE });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ method: "pin" });
  });

  it("surfaces an unregistered phone as a failure", async () => {
    vi.mocked(startLogin).mockRejectedValue(new Error("OTP_USER_NOT_FOUND"));

    const result = await startLoginAction({ phone: PHONE });

    expect(result.success).toBe(false);
    expect(result.error).toBe("OTP_USER_NOT_FOUND");
  });
});

describe("verifyPinAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a session on a valid pin", async () => {
    vi.mocked(verifyPinLogin).mockResolvedValue("usr_1");

    const result = await verifyPinAction({ phone: PHONE, pin: "1234" });

    expect(result.success).toBe(true);
    expect(createSession).toHaveBeenCalledWith("usr_1");
  });

  it("does not create a session on an invalid pin", async () => {
    vi.mocked(verifyPinLogin).mockRejectedValue(new Error("PIN_INVALID"));

    const result = await verifyPinAction({ phone: PHONE, pin: "0000" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("PIN_INVALID");
    expect(createSession).not.toHaveBeenCalled();
  });

  it("rejects a malformed pin before hitting the service", async () => {
    const result = await verifyPinAction({ phone: PHONE, pin: "12" });

    expect(result.success).toBe(false);
    expect(verifyPinLogin).not.toHaveBeenCalled();
  });
});

describe("setPinAction / removePinAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("setPinAction requires a session", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    const result = await setPinAction({ pin: "1234" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("NO_SESSION");
    expect(setManagerPin).not.toHaveBeenCalled();
  });

  it("setPinAction stores the pin for the signed-in user", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("usr_1");

    const result = await setPinAction({ pin: "1234" });

    expect(result.success).toBe(true);
    expect(setManagerPin).toHaveBeenCalledWith("usr_1", "1234");
  });

  it("removePinAction requires a session", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    const result = await removePinAction();

    expect(result.success).toBe(false);
    expect(removeManagerPin).not.toHaveBeenCalled();
  });

  it("removePinAction clears the pin", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("usr_1");

    const result = await removePinAction();

    expect(result.success).toBe(true);
    expect(removeManagerPin).toHaveBeenCalledWith("usr_1");
  });
});
