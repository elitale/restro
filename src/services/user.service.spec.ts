import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/generated/prisma/client";

vi.mock("@/repositories/user.repository", () => ({
  createUser: vi.fn(),
  findUserById: vi.fn(),
  findUserByPhone: vi.fn(),
  findUserByEmail: vi.fn(),
  updateUser: vi.fn(),
}));

import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByPhone,
  updateUser,
} from "@/repositories/user.repository";
import {
  addEmailToManager,
  EMAIL_ALREADY_IN_USE,
  PHONE_ALREADY_REGISTERED,
  registerManager,
  USER_NOT_FOUND,
} from "./user.service";

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: "usr_1",
  phone: "+919876543210",
  phoneVerifiedAt: null,
  email: null,
  emailVerifiedAt: null,
  name: null,
  role: "MANAGER",
  isActive: true,
  suspendedAt: null,
  deletedAt: null,
  pinHash: null,
  pinUpdatedAt: null,
  pinFailedAttempts: 0,
  pinLockedUntil: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

describe("registerManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a manager when the phone is new", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(null);
    const created = makeUser({ name: "Asha" });
    vi.mocked(createUser).mockResolvedValue(created);

    const result = await registerManager({
      phone: "+919876543210",
      name: "Asha",
    });

    expect(findUserByPhone).toHaveBeenCalledWith("+919876543210");
    expect(createUser).toHaveBeenCalledWith({
      phone: "+919876543210",
      name: "Asha",
    });
    expect(result).toBe(created);
  });

  it("defaults name to null when omitted", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(null);
    vi.mocked(createUser).mockResolvedValue(makeUser());

    await registerManager({ phone: "+919876543210" });

    expect(createUser).toHaveBeenCalledWith({
      phone: "+919876543210",
      name: null,
    });
  });

  it("rejects a phone that already exists", async () => {
    vi.mocked(findUserByPhone).mockResolvedValue(makeUser());

    await expect(
      registerManager({ phone: "+919876543210" }),
    ).rejects.toThrow(PHONE_ALREADY_REGISTERED);
    expect(createUser).not.toHaveBeenCalled();
  });
});

describe("addEmailToManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds an email to an existing manager", async () => {
    vi.mocked(findUserById).mockResolvedValue(makeUser());
    vi.mocked(findUserByEmail).mockResolvedValue(null);
    const updated = makeUser({ email: "asha@spice.test" });
    vi.mocked(updateUser).mockResolvedValue(updated);

    const result = await addEmailToManager("usr_1", "asha@spice.test");

    expect(updateUser).toHaveBeenCalledWith("usr_1", {
      email: "asha@spice.test",
    });
    expect(result).toBe(updated);
  });

  it("throws when the manager does not exist", async () => {
    vi.mocked(findUserById).mockResolvedValue(null);

    await expect(
      addEmailToManager("missing", "asha@spice.test"),
    ).rejects.toThrow(USER_NOT_FOUND);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects an email already used by another manager", async () => {
    vi.mocked(findUserById).mockResolvedValue(makeUser({ id: "usr_1" }));
    vi.mocked(findUserByEmail).mockResolvedValue(makeUser({ id: "usr_2" }));

    await expect(
      addEmailToManager("usr_1", "taken@spice.test"),
    ).rejects.toThrow(EMAIL_ALREADY_IN_USE);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("allows a manager to re-set their own email", async () => {
    vi.mocked(findUserById).mockResolvedValue(makeUser({ id: "usr_1" }));
    vi.mocked(findUserByEmail).mockResolvedValue(
      makeUser({ id: "usr_1", email: "asha@spice.test" }),
    );
    const updated = makeUser({ id: "usr_1", email: "asha@spice.test" });
    vi.mocked(updateUser).mockResolvedValue(updated);

    const result = await addEmailToManager("usr_1", "asha@spice.test");

    expect(result).toBe(updated);
  });
});
