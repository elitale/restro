import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
    OtpChallenge,
    Restaurant,
    Staff,
    User,
} from "@/generated/prisma/client";

process.env.AUTH_SECRET = "mobile-auth-test-secret";

vi.mock("@/lib/twilio", () => ({ sendSms: vi.fn() }));
vi.mock("@/lib/pin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pin")>("@/lib/pin");
  return { ...actual, verifyPin: vi.fn() };
});
vi.mock("@/repositories/otp.repository", () => ({
  countRecentChallenges: vi.fn(),
  createOtpChallenge: vi.fn(),
  findLatestActiveChallenge: vi.fn(),
  incrementChallengeAttempts: vi.fn(),
  consumeChallenge: vi.fn(),
}));
vi.mock("@/repositories/user.repository", () => ({
  findUserById: vi.fn(),
  findUserByPhone: vi.fn(),
  recordPinFailure: vi.fn(),
  resetPinCounters: vi.fn(),
}));
vi.mock("@/repositories/staff.repository", () => ({
  findActiveStaffByPhone: vi.fn(),
  findStaffById: vi.fn(),
  recordStaffLoginFailure: vi.fn(),
  resetStaffLoginCounters: vi.fn(),
}));
vi.mock("@/repositories/restaurant.repository", () => ({
  findFirstRestaurantByOwner: vi.fn(),
  findRestaurantById: vi.fn(),
}));

import { verifyMobileBearerToken } from "@/lib/mobile-session";
import { hashOtpCode } from "@/lib/otp";
import { verifyPin as verifyManagerPin } from "@/lib/pin";
import { hashStaffPin } from "@/lib/staff-pin";
import { sendSms } from "@/lib/twilio";
import {
    consumeChallenge,
    countRecentChallenges,
    createOtpChallenge,
    findLatestActiveChallenge,
    incrementChallengeAttempts,
} from "@/repositories/otp.repository";
import {
    findFirstRestaurantByOwner,
    findRestaurantById,
} from "@/repositories/restaurant.repository";
import {
    findActiveStaffByPhone,
    findStaffById,
    recordStaffLoginFailure,
    resetStaffLoginCounters,
} from "@/repositories/staff.repository";
import {
    findUserById,
    findUserByPhone,
    recordPinFailure,
    resetPinCounters,
} from "@/repositories/user.repository";

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
    getMobileUserProfile,
    requestMobileOtp,
    verifyMobileOtp,
    verifyMobilePin,
} from "./mobile-auth.service";

const PHONE = "+919876543210";
const RESTAURANT_ID = "rst_1";
const RESTAURANT_NAME = "Spice Route";

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: "usr_1",
  phone: PHONE,
  phoneVerifiedAt: new Date(),
  email: null,
  emailVerifiedAt: null,
  name: "Rajesh",
  role: "MANAGER",
  isActive: true,
  suspendedAt: null,
  deletedAt: null,
  pinHash: null,
  pinUpdatedAt: null,
  pinFailedAttempts: 0,
  pinLockedUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeStaff = (overrides: Partial<Staff> = {}): Staff => ({
  id: "stf_1",
  restaurantId: RESTAURANT_ID,
  employeeCode: "E1",
  name: "Ramesh",
  role: "WAITER",
  status: "ACTIVE",
  photoUrl: null,
  phone: PHONE,
  email: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  postalCode: null,
  dateOfBirth: null,
  gender: null,
  joiningDate: null,
  employmentType: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  notes: null,
  pinHash: hashStaffPin("482913", RESTAURANT_ID),
  loginFailedAttempts: 0,
  loginLockedUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

const makeRestaurant = (overrides: Partial<Restaurant> = {}): Restaurant =>
  ({
    id: RESTAURANT_ID,
    name: RESTAURANT_NAME,
    ...overrides,
  }) as Restaurant;

const makeChallenge = (
  overrides: Partial<OtpChallenge> = {},
): OtpChallenge => ({
  id: "otp_1",
  phone: PHONE,
  codeHash: hashOtpCode("123456"),
  expiresAt: new Date(Date.now() + 60_000),
  attempts: 0,
  consumedAt: null,
  createdAt: new Date(),
  ...overrides,
});

const wireManagerLookup = (user: User) => {
  vi.mocked(findUserByPhone).mockResolvedValue(user);
  vi.mocked(findFirstRestaurantByOwner).mockResolvedValue(makeRestaurant());
};

const wireStaffLookup = (staff: Staff) => {
  vi.mocked(findUserByPhone).mockResolvedValue(null);
  vi.mocked(findActiveStaffByPhone).mockResolvedValue([staff]);
  vi.mocked(findRestaurantById).mockResolvedValue(makeRestaurant());
};

describe("requestMobileOtp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a challenge, texts the code, and returns kind:manager for a User phone", async () => {
    wireManagerLookup(makeUser());
    vi.mocked(countRecentChallenges).mockResolvedValue(0);
    vi.mocked(createOtpChallenge).mockResolvedValue(
      makeChallenge({ id: "otp_new" }),
    );

    const result = await requestMobileOtp(PHONE);

    expect(result.kind).toBe("manager");
    expect(result.challengeId).toBe("otp_new");
    expect(new Date(result.resendAvailableAt).getTime()).toBeGreaterThan(
      Date.now(),
    );
    expect(sendSms).toHaveBeenCalledWith(
      PHONE,
      expect.stringContaining("code"),
    );
  });

  it("returns kind:staff when only a Staff row matches", async () => {
    wireStaffLookup(makeStaff());
    vi.mocked(countRecentChallenges).mockResolvedValue(0);
    vi.mocked(createOtpChallenge).mockResolvedValue(makeChallenge());

    const result = await requestMobileOtp(PHONE);

    expect(result.kind).toBe("staff");
  });

  it("throws USER_NOT_FOUND when the phone is unknown", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(null);
    vi.mocked(findActiveStaffByPhone).mockResolvedValue([]);

    await expect(requestMobileOtp(PHONE)).rejects.toThrow(
      MOBILE_USER_NOT_FOUND,
    );
    expect(createOtpChallenge).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("throws MULTI_RESTAURANT_UNSUPPORTED when the staff phone lives in >1 restaurant", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(null);
    vi.mocked(findActiveStaffByPhone).mockResolvedValue([
      makeStaff(),
      makeStaff({ id: "stf_2", restaurantId: "rst_2" }),
    ]);

    await expect(requestMobileOtp(PHONE)).rejects.toThrow(
      MOBILE_MULTI_RESTAURANT_UNSUPPORTED,
    );
    expect(sendSms).not.toHaveBeenCalled();
  });

  it("rate-limits rapid resends", async () => {
    wireManagerLookup(makeUser());
    vi.mocked(countRecentChallenges).mockResolvedValue(1);

    await expect(requestMobileOtp(PHONE)).rejects.toThrow(
      MOBILE_OTP_RATE_LIMITED,
    );
    expect(createOtpChallenge).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });
});

describe("verifyMobileOtp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("issues a bearer token and manager user on a correct code", async () => {
    vi.mocked(findLatestActiveChallenge).mockResolvedValue(makeChallenge());
    wireManagerLookup(makeUser());

    const result = await verifyMobileOtp({
      phone: PHONE,
      challengeId: "otp_1",
      code: "123456",
    });

    expect(consumeChallenge).toHaveBeenCalledWith("otp_1");
    expect(result.user).toMatchObject({
      id: "usr_1",
      phone: PHONE,
      kind: "manager",
      role: "MANAGER",
      restaurantId: RESTAURANT_ID,
      restaurantName: RESTAURANT_NAME,
    });
    const decoded = await verifyMobileBearerToken(result.token);
    expect(decoded).toMatchObject({
      subjectId: "usr_1",
      kind: "manager",
      role: "MANAGER",
      restaurantId: RESTAURANT_ID,
    });
  });

  it("issues a staff bearer token when the phone belongs to a staff row", async () => {
    vi.mocked(findLatestActiveChallenge).mockResolvedValue(makeChallenge());
    wireStaffLookup(makeStaff());

    const result = await verifyMobileOtp({
      phone: PHONE,
      challengeId: "otp_1",
      code: "123456",
    });

    expect(result.user.kind).toBe("staff");
    expect(result.user.role).toBe("WAITER");
    const decoded = await verifyMobileBearerToken(result.token);
    expect(decoded?.kind).toBe("staff");
  });

  it("throws OTP_EXPIRED when the challengeId does not match", async () => {
    vi.mocked(findLatestActiveChallenge).mockResolvedValue(makeChallenge());

    await expect(
      verifyMobileOtp({
        phone: PHONE,
        challengeId: "stale-id",
        code: "123456",
      }),
    ).rejects.toThrow(MOBILE_OTP_EXPIRED);
    expect(consumeChallenge).not.toHaveBeenCalled();
  });

  it("throws OTP_EXPIRED when no active challenge exists", async () => {
    vi.mocked(findLatestActiveChallenge).mockResolvedValue(null);

    await expect(
      verifyMobileOtp({
        phone: PHONE,
        challengeId: "otp_1",
        code: "123456",
      }),
    ).rejects.toThrow(MOBILE_OTP_EXPIRED);
  });

  it("throws OTP_LOCKED after too many attempts", async () => {
    vi.mocked(findLatestActiveChallenge).mockResolvedValue(
      makeChallenge({ attempts: 5 }),
    );

    await expect(
      verifyMobileOtp({
        phone: PHONE,
        challengeId: "otp_1",
        code: "123456",
      }),
    ).rejects.toThrow(MOBILE_OTP_LOCKED);
  });

  it("throws OTP_INVALID and increments attempts on a wrong code", async () => {
    vi.mocked(findLatestActiveChallenge).mockResolvedValue(makeChallenge());

    await expect(
      verifyMobileOtp({
        phone: PHONE,
        challengeId: "otp_1",
        code: "999999",
      }),
    ).rejects.toThrow(MOBILE_OTP_INVALID);
    expect(incrementChallengeAttempts).toHaveBeenCalledWith("otp_1");
    expect(consumeChallenge).not.toHaveBeenCalled();
  });
});

describe("verifyMobilePin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a manager token when the manager PIN matches", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(
      makeUser({ pinHash: "scrypt$aa$bb" }),
    );
    vi.mocked(findFirstRestaurantByOwner).mockResolvedValue(makeRestaurant());
    vi.mocked(verifyManagerPin).mockReturnValue(true);

    const result = await verifyMobilePin({ phone: PHONE, pin: "482913" });

    expect(resetPinCounters).toHaveBeenCalledWith("usr_1");
    expect(result.user.kind).toBe("manager");
    const decoded = await verifyMobileBearerToken(result.token);
    expect(decoded?.kind).toBe("manager");
  });

  it("throws PIN_NOT_SET when the manager has no PIN", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(makeUser({ pinHash: null }));

    await expect(
      verifyMobilePin({ phone: PHONE, pin: "482913" }),
    ).rejects.toThrow(MOBILE_PIN_NOT_SET);
  });

  it("throws PIN_LOCKED when the manager is currently locked", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(
      makeUser({
        pinHash: "scrypt$aa$bb",
        pinLockedUntil: new Date(Date.now() + 60_000),
      }),
    );

    await expect(
      verifyMobilePin({ phone: PHONE, pin: "482913" }),
    ).rejects.toThrow(MOBILE_PIN_LOCKED);
  });

  it("throws PIN_INVALID and records failure on a wrong manager PIN", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(
      makeUser({ pinHash: "scrypt$aa$bb", pinFailedAttempts: 2 }),
    );
    vi.mocked(verifyManagerPin).mockReturnValue(false);

    await expect(
      verifyMobilePin({ phone: PHONE, pin: "wrong1" }),
    ).rejects.toThrow(MOBILE_PIN_INVALID);
    expect(recordPinFailure).toHaveBeenCalledWith("usr_1", {
      failedAttempts: 3,
      lockedUntil: null,
    });
  });

  it("locks the manager on the 5th failed PIN attempt", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(
      makeUser({ pinHash: "scrypt$aa$bb", pinFailedAttempts: 4 }),
    );
    vi.mocked(verifyManagerPin).mockReturnValue(false);

    await expect(
      verifyMobilePin({ phone: PHONE, pin: "wrong1" }),
    ).rejects.toThrow(MOBILE_PIN_INVALID);
    expect(recordPinFailure).toHaveBeenCalledWith(
      "usr_1",
      expect.objectContaining({ failedAttempts: 5 }),
    );
    const args = vi.mocked(recordPinFailure).mock.calls[0]![1];
    expect(args.lockedUntil).toBeInstanceOf(Date);
  });

  it("returns a staff token when the staff PIN matches", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(null);
    vi.mocked(findActiveStaffByPhone).mockResolvedValue([makeStaff()]);
    vi.mocked(findRestaurantById).mockResolvedValue(makeRestaurant());

    const result = await verifyMobilePin({ phone: PHONE, pin: "482913" });

    expect(resetStaffLoginCounters).toHaveBeenCalledWith("stf_1");
    expect(result.user.kind).toBe("staff");
    expect(result.user.role).toBe("WAITER");
  });

  it("throws PIN_INVALID and records failure on a wrong staff PIN", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(null);
    vi.mocked(findActiveStaffByPhone).mockResolvedValue([
      makeStaff({ loginFailedAttempts: 1 }),
    ]);

    await expect(
      verifyMobilePin({ phone: PHONE, pin: "000000" }),
    ).rejects.toThrow(MOBILE_PIN_INVALID);
    expect(recordStaffLoginFailure).toHaveBeenCalledWith("stf_1", {
      failedAttempts: 2,
      lockedUntil: null,
    });
  });

  it("throws PIN_LOCKED when the staff account is currently locked", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(null);
    vi.mocked(findActiveStaffByPhone).mockResolvedValue([
      makeStaff({ loginLockedUntil: new Date(Date.now() + 30_000) }),
    ]);

    await expect(
      verifyMobilePin({ phone: PHONE, pin: "482913" }),
    ).rejects.toThrow(MOBILE_PIN_LOCKED);
  });
});

describe("getMobileUserProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a fresh manager profile from the token payload", async () => {
    vi.mocked(findUserById).mockResolvedValue(makeUser({ name: "Updated" }));
    vi.mocked(findFirstRestaurantByOwner).mockResolvedValue(makeRestaurant());

    const profile = await getMobileUserProfile({
      subjectId: "usr_1",
      kind: "manager",
      restaurantId: RESTAURANT_ID,
      role: "MANAGER",
    });

    expect(findUserById).toHaveBeenCalledWith("usr_1");
    expect(profile).toMatchObject({
      id: "usr_1",
      name: "Updated",
      kind: "manager",
      restaurantId: RESTAURANT_ID,
      restaurantName: RESTAURANT_NAME,
    });
  });

  it("returns a fresh staff profile from the token payload", async () => {
    vi.mocked(findStaffById).mockResolvedValue(makeStaff({ name: "Rohit" }));
    vi.mocked(findRestaurantById).mockResolvedValue(makeRestaurant());

    const profile = await getMobileUserProfile({
      subjectId: "stf_1",
      kind: "staff",
      restaurantId: RESTAURANT_ID,
      role: "WAITER",
    });

    expect(findStaffById).toHaveBeenCalledWith("stf_1");
    expect(profile.kind).toBe("staff");
    expect(profile.name).toBe("Rohit");
  });

  it("throws USER_NOT_FOUND when the manager row was soft-deleted", async () => {
    vi.mocked(findUserById).mockResolvedValue(
      makeUser({ deletedAt: new Date() }),
    );

    await expect(
      getMobileUserProfile({
        subjectId: "usr_1",
        kind: "manager",
        restaurantId: null,
        role: "MANAGER",
      }),
    ).rejects.toThrow(MOBILE_USER_NOT_FOUND);
  });

  it("throws USER_NOT_FOUND when the staff row is no longer ACTIVE", async () => {
    vi.mocked(findStaffById).mockResolvedValue(
      makeStaff({ status: "INACTIVE" }),
    );

    await expect(
      getMobileUserProfile({
        subjectId: "stf_1",
        kind: "staff",
        restaurantId: RESTAURANT_ID,
        role: "WAITER",
      }),
    ).rejects.toThrow(MOBILE_USER_NOT_FOUND);
  });
});
