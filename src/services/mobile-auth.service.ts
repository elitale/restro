import type { Staff, User } from "@/generated/prisma/client";
import {
    issueMobileBearerToken,
    type MobileTokenPayload,
    type MobileTokenRole,
} from "@/lib/mobile-session";
import { generateOtpCode, hashOtpCode } from "@/lib/otp";
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

// Domain error codes surfaced to the mobile client via HttpError.
export const MOBILE_USER_NOT_FOUND = "USER_NOT_FOUND";
export const MOBILE_OTP_RATE_LIMITED = "OTP_RATE_LIMITED";
export const MOBILE_OTP_EXPIRED = "OTP_EXPIRED";
export const MOBILE_OTP_INVALID = "OTP_INVALID";
export const MOBILE_OTP_LOCKED = "OTP_LOCKED";
export const MOBILE_PIN_INVALID = "PIN_INVALID";
export const MOBILE_PIN_LOCKED = "PIN_LOCKED";
export const MOBILE_PIN_NOT_SET = "PIN_NOT_SET";
export const MOBILE_MULTI_RESTAURANT_UNSUPPORTED =
  "MULTI_RESTAURANT_UNSUPPORTED";

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_WINDOW_MS = 30 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_MANAGER_PIN_ATTEMPTS = 5;
const MANAGER_PIN_LOCK_MS = 15 * 60_000;
const MAX_STAFF_PIN_ATTEMPTS = 5;
const STAFF_PIN_LOCK_MS = 60_000;

export type MobileAuthKind = "manager" | "staff";

export interface MobileAuthUser {
  readonly id: string;
  readonly phone: string;
  readonly name: string | null;
  readonly role: MobileTokenRole;
  readonly kind: MobileAuthKind;
  readonly restaurantId: string | null;
  readonly restaurantName: string | null;
}

export interface RequestOtpResult {
  readonly challengeId: string;
  readonly resendAvailableAt: string;
  readonly kind: MobileAuthKind;
}

export interface AuthResult {
  readonly token: string;
  readonly user: MobileAuthUser;
}

type PhoneOwner =
  | { readonly kind: "manager"; readonly user: User }
  | { readonly kind: "staff"; readonly staff: Staff };

const findEligibleUser = async (phone: string): Promise<User | null> => {
  const user = await findUserByPhone(phone);
  if (!user || user.deletedAt || user.suspendedAt || !user.isActive) {
    return null;
  }
  return user;
};

const findEligibleStaff = async (phone: string): Promise<Staff> => {
  const rows = await findActiveStaffByPhone(phone);
  if (rows.length === 0) {
    throw new Error(MOBILE_USER_NOT_FOUND);
  }
  // Multi-restaurant flag deferred to v1.1; force single-restaurant for now
  // rather than silently picking one.
  if (rows.length > 1) {
    throw new Error(MOBILE_MULTI_RESTAURANT_UNSUPPORTED);
  }
  return rows[0];
};

const resolvePhoneOwner = async (phone: string): Promise<PhoneOwner> => {
  const user = await findEligibleUser(phone);
  if (user) return { kind: "manager", user };
  const staff = await findEligibleStaff(phone);
  return { kind: "staff", staff };
};

const managerToAuthUser = async (user: User): Promise<MobileAuthUser> => {
  const restaurant = await findFirstRestaurantByOwner(user.id);
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    kind: "manager",
    restaurantId: restaurant?.id ?? null,
    restaurantName: restaurant?.name ?? null,
  };
};

const staffToAuthUser = async (staff: Staff): Promise<MobileAuthUser> => {
  const restaurant = await findRestaurantById(staff.restaurantId);
  return {
    id: staff.id,
    phone: staff.phone,
    name: staff.name,
    role: staff.role,
    kind: "staff",
    restaurantId: staff.restaurantId,
    restaurantName: restaurant?.name ?? null,
  };
};

const toAuthUser = (owner: PhoneOwner): Promise<MobileAuthUser> =>
  owner.kind === "manager"
    ? managerToAuthUser(owner.user)
    : staffToAuthUser(owner.staff);

const tokenPayloadFor = (user: MobileAuthUser) => ({
  subjectId: user.id,
  kind: user.kind,
  restaurantId: user.restaurantId,
  role: user.role,
});

/** Issue an OTP challenge for a phone that belongs to a manager or a staff row. */
export const requestMobileOtp = async (
  phone: string,
): Promise<RequestOtpResult> => {
  const owner = await resolvePhoneOwner(phone);

  const recentCutoff = new Date(Date.now() - RESEND_WINDOW_MS);
  if ((await countRecentChallenges(phone, recentCutoff)) > 0) {
    throw new Error(MOBILE_OTP_RATE_LIMITED);
  }

  const code = generateOtpCode();
  const challenge = await createOtpChallenge({
    phone,
    codeHash: hashOtpCode(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  await sendSms(
    phone,
    `Your ElitaleRestro verification code is ${code}. It expires in 5 minutes.`,
  );

  return {
    challengeId: challenge.id,
    resendAvailableAt: new Date(Date.now() + RESEND_WINDOW_MS).toISOString(),
    kind: owner.kind,
  };
};

/** Verify an OTP and return a signed bearer token + a client-safe user object. */
export const verifyMobileOtp = async (input: {
  phone: string;
  challengeId: string;
  code: string;
}): Promise<AuthResult> => {
  const challenge = await findLatestActiveChallenge(input.phone, new Date());
  // Match by id so an unrelated concurrent challenge can't be silently spent.
  if (!challenge || challenge.id !== input.challengeId) {
    throw new Error(MOBILE_OTP_EXPIRED);
  }
  if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
    throw new Error(MOBILE_OTP_LOCKED);
  }
  if (hashOtpCode(input.code) !== challenge.codeHash) {
    await incrementChallengeAttempts(challenge.id);
    throw new Error(MOBILE_OTP_INVALID);
  }

  const owner = await resolvePhoneOwner(input.phone);
  await consumeChallenge(challenge.id);

  // Reset PIN counters on a successful sign-in — either channel unlocks the account.
  if (owner.kind === "manager") {
    if (owner.user.pinFailedAttempts > 0 || owner.user.pinLockedUntil) {
      await resetPinCounters(owner.user.id);
    }
  } else if (
    owner.staff.loginFailedAttempts > 0 ||
    owner.staff.loginLockedUntil
  ) {
    await resetStaffLoginCounters(owner.staff.id);
  }

  const user = await toAuthUser(owner);
  const token = await issueMobileBearerToken(tokenPayloadFor(user));
  return { token, user };
};

/**
 * Verify a phone + PIN. Managers use their scrypt-hashed login PIN; staff use
 * the HMAC-scoped POS PIN. Failures are always surfaced as `PIN_INVALID` to
 * avoid enumerating which table the phone lives in.
 */
export const verifyMobilePin = async (input: {
  phone: string;
  pin: string;
}): Promise<AuthResult> => {
  const managerUser = await findEligibleUser(input.phone);

  if (managerUser) {
    if (!managerUser.pinHash) {
      throw new Error(MOBILE_PIN_NOT_SET);
    }
    if (
      managerUser.pinLockedUntil &&
      managerUser.pinLockedUntil.getTime() > Date.now()
    ) {
      throw new Error(MOBILE_PIN_LOCKED);
    }
    if (!verifyManagerPin(input.pin, managerUser.pinHash)) {
      const failedAttempts = managerUser.pinFailedAttempts + 1;
      const lockedUntil =
        failedAttempts >= MAX_MANAGER_PIN_ATTEMPTS
          ? new Date(Date.now() + MANAGER_PIN_LOCK_MS)
          : null;
      await recordPinFailure(managerUser.id, { failedAttempts, lockedUntil });
      throw new Error(MOBILE_PIN_INVALID);
    }
    await resetPinCounters(managerUser.id);
    const user = await managerToAuthUser(managerUser);
    const token = await issueMobileBearerToken(tokenPayloadFor(user));
    return { token, user };
  }

  const staff = await findEligibleStaff(input.phone);

  if (staff.loginLockedUntil && staff.loginLockedUntil.getTime() > Date.now()) {
    throw new Error(MOBILE_PIN_LOCKED);
  }
  if (hashStaffPin(input.pin, staff.restaurantId) !== staff.pinHash) {
    const failedAttempts = staff.loginFailedAttempts + 1;
    const lockedUntil =
      failedAttempts >= MAX_STAFF_PIN_ATTEMPTS
        ? new Date(Date.now() + STAFF_PIN_LOCK_MS)
        : null;
    await recordStaffLoginFailure(staff.id, { failedAttempts, lockedUntil });
    throw new Error(MOBILE_PIN_INVALID);
  }
  await resetStaffLoginCounters(staff.id);
  const user = await staffToAuthUser(staff);
  const token = await issueMobileBearerToken(tokenPayloadFor(user));
  return { token, user };
};

/**
 * Look the current signed-in mobile user up from a verified token payload.
 * Throws USER_NOT_FOUND if the row was deleted, suspended, or deactivated
 * after the token was issued — the client should re-authenticate.
 */
export const getMobileUserProfile = async (
  payload: MobileTokenPayload,
): Promise<MobileAuthUser> => {
  if (payload.kind === "manager") {
    const user = await findUserById(payload.subjectId);
    if (!user || user.deletedAt || user.suspendedAt || !user.isActive) {
      throw new Error(MOBILE_USER_NOT_FOUND);
    }
    return managerToAuthUser(user);
  }
  const staff = await findStaffById(payload.subjectId);
  if (!staff || staff.deletedAt || staff.status !== "ACTIVE") {
    throw new Error(MOBILE_USER_NOT_FOUND);
  }
  return staffToAuthUser(staff);
};
