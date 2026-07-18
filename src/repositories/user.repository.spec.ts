import { beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/generated/prisma/client";

const { create, findUnique, findMany, count, update } = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { create, findUnique, findMany, count, update } },
}));

import {
  createUser,
  clearUserPin,
  findUserByEmail,
  findUserById,
  findUserByPhone,
  findUsersPaginated,
  getUserAuthState,
  recordPinFailure,
  resetPinCounters,
  setUserPin,
  updateUser,
} from "./user.repository";

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

describe("userRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createUser forwards data to prisma.user.create", async () => {
    const user = makeUser();
    create.mockResolvedValue(user);

    const result = await createUser({ phone: user.phone });

    expect(create).toHaveBeenCalledWith({ data: { phone: user.phone } });
    expect(result).toBe(user);
  });

  it("findUserById queries by id", async () => {
    const user = makeUser();
    findUnique.mockResolvedValue(user);

    const result = await findUserById("usr_1");

    expect(findUnique).toHaveBeenCalledWith({ where: { id: "usr_1" } });
    expect(result).toBe(user);
  });

  it("findUserByPhone queries by phone", async () => {
    findUnique.mockResolvedValue(null);

    const result = await findUserByPhone("+910000000000");

    expect(findUnique).toHaveBeenCalledWith({
      where: { phone: "+910000000000" },
    });
    expect(result).toBeNull();
  });

  it("findUserByEmail queries by email", async () => {
    findUnique.mockResolvedValue(null);

    await findUserByEmail("asha@spice.test");

    expect(findUnique).toHaveBeenCalledWith({
      where: { email: "asha@spice.test" },
    });
  });

  it("updateUser updates by id", async () => {
    const user = makeUser({ email: "asha@spice.test" });
    update.mockResolvedValue(user);

    const result = await updateUser("usr_1", { email: "asha@spice.test" });

    expect(update).toHaveBeenCalledWith({
      where: { id: "usr_1" },
      data: { email: "asha@spice.test" },
    });
    expect(result).toBe(user);
  });

  it("setUserPin stores the hash and resets counters", async () => {
    update.mockResolvedValue(makeUser());

    await setUserPin("usr_1", "scrypt$aa$bb");

    expect(update).toHaveBeenCalledWith({
      where: { id: "usr_1" },
      data: {
        pinHash: "scrypt$aa$bb",
        pinUpdatedAt: expect.any(Date),
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      },
    });
  });

  it("clearUserPin nulls the hash and resets counters", async () => {
    update.mockResolvedValue(makeUser());

    await clearUserPin("usr_1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "usr_1" },
      data: {
        pinHash: null,
        pinUpdatedAt: null,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      },
    });
  });

  it("recordPinFailure writes the attempt count + lock", async () => {
    const lockedUntil = new Date("2026-02-01T00:00:00.000Z");
    update.mockResolvedValue(makeUser());

    await recordPinFailure("usr_1", { failedAttempts: 5, lockedUntil });

    expect(update).toHaveBeenCalledWith({
      where: { id: "usr_1" },
      data: { pinFailedAttempts: 5, pinLockedUntil: lockedUntil },
    });
  });

  it("resetPinCounters clears attempts + lock", async () => {
    update.mockResolvedValue(makeUser());

    await resetPinCounters("usr_1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "usr_1" },
      data: { pinFailedAttempts: 0, pinLockedUntil: null },
    });
  });

  it("getUserAuthState selects role + status flags", async () => {
    findUnique.mockResolvedValue({
      role: "ADMIN",
      suspendedAt: null,
      deletedAt: null,
    });

    const result = await getUserAuthState("usr_1");

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "usr_1" },
      select: { role: true, suspendedAt: true, deletedAt: true },
    });
    expect(result).toEqual({ role: "ADMIN", suspendedAt: null, deletedAt: null });
  });

  it("findUsersPaginated filters by role + search and paginates", async () => {
    const rows = [makeUser()];
    findMany.mockResolvedValue(rows);
    count.mockResolvedValue(1);

    const result = await findUsersPaginated({
      role: "ADMIN",
      search: "asha",
      page: 2,
      pageSize: 10,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: { createdAt: "desc" },
        where: expect.objectContaining({ role: "ADMIN" }),
      }),
    );
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: "ADMIN" }),
      }),
    );
    expect(result).toEqual({ items: rows, total: 1 });
  });
});
