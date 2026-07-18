import type { User } from "@/generated/prisma/client";
import type { RegisterManagerInput } from "@/lib/validators/user";
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByPhone,
  updateUser,
} from "@/repositories/user.repository";

export const PHONE_ALREADY_REGISTERED = "PHONE_ALREADY_REGISTERED";
export const EMAIL_ALREADY_IN_USE = "EMAIL_ALREADY_IN_USE";
export const USER_NOT_FOUND = "USER_NOT_FOUND";

/**
 * Register a restaurant manager using their phone number as the primary
 * identifier. Fails if the phone is already registered.
 */
export const registerManager = async (
  input: RegisterManagerInput,
): Promise<User> => {
  const existing = await findUserByPhone(input.phone);
  if (existing) {
    throw new Error(PHONE_ALREADY_REGISTERED);
  }

  return createUser({ phone: input.phone, name: input.name ?? null });
};

export const getManagerById = (id: string): Promise<User | null> =>
  findUserById(id);

export const getManagerByPhone = (phone: string): Promise<User | null> =>
  findUserByPhone(phone);

/**
 * Attach (or change) a manager's email — added later for notifications.
 * Fails if the manager is missing or the email belongs to another manager.
 */
export const addEmailToManager = async (
  userId: string,
  email: string,
): Promise<User> => {
  const user = await findUserById(userId);
  if (!user) {
    throw new Error(USER_NOT_FOUND);
  }

  const emailOwner = await findUserByEmail(email);
  if (emailOwner && emailOwner.id !== userId) {
    throw new Error(EMAIL_ALREADY_IN_USE);
  }

  return updateUser(userId, { email });
};
