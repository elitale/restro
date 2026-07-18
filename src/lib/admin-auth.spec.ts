import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({
  getCurrentUserId: vi.fn(),
}));
vi.mock("@/repositories/user.repository", () => ({
  getUserAuthState: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import { getCurrentUserId } from "@/lib/auth-helpers";
import { getUserAuthState } from "@/repositories/user.repository";
import {
  getAdminContextOrNull,
  isAdminRole,
  isSuperAdmin,
  requireAdminPage,
} from "./admin-auth";

describe("isAdminRole / isSuperAdmin", () => {
  it("classifies roles", () => {
    expect(isAdminRole("MANAGER")).toBe(false);
    expect(isAdminRole("ADMIN")).toBe(true);
    expect(isAdminRole("SUPER_ADMIN")).toBe(true);
    expect(isSuperAdmin("ADMIN")).toBe(false);
    expect(isSuperAdmin("SUPER_ADMIN")).toBe(true);
  });
});

describe("getAdminContextOrNull", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when unauthenticated", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    expect(await getAdminContextOrNull()).toBeNull();
    expect(getUserAuthState).not.toHaveBeenCalled();
  });

  it("returns null for a non-admin", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("usr_1");
    vi.mocked(getUserAuthState).mockResolvedValue({
      role: "MANAGER",
      suspendedAt: null,
      deletedAt: null,
    });

    expect(await getAdminContextOrNull()).toBeNull();
  });

  it("returns null for a suspended admin", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("usr_1");
    vi.mocked(getUserAuthState).mockResolvedValue({
      role: "ADMIN",
      suspendedAt: new Date("2026-02-01T00:00:00.000Z"),
      deletedAt: null,
    });

    expect(await getAdminContextOrNull()).toBeNull();
  });

  it("returns context for an active admin", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("usr_1");
    vi.mocked(getUserAuthState).mockResolvedValue({
      role: "ADMIN",
      suspendedAt: null,
      deletedAt: null,
    });

    expect(await getAdminContextOrNull()).toEqual({
      userId: "usr_1",
      role: "ADMIN",
    });
  });
});

describe("requireAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound for non-admins", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    await expect(requireAdminPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
