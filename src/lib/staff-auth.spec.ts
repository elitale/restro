import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Staff } from "@/generated/prisma/client";

vi.mock("@/lib/staff-session", () => ({ getStaffSession: vi.fn() }));
vi.mock("@/repositories/staff.repository", () => ({ findStaffById: vi.fn() }));

import { getStaffSession } from "@/lib/staff-session";
import { findStaffById } from "@/repositories/staff.repository";
import { getStaffContextOrNull } from "./staff-auth";

const makeStaff = (o: Record<string, unknown> = {}): Staff =>
  ({
    id: "st1",
    restaurantId: "res_1",
    employeeCode: "E1",
    name: "Ramesh",
    role: "WAITER",
    status: "ACTIVE",
    deletedAt: null,
    ...o,
  }) as unknown as Staff;

const session = {
  staffId: "st1",
  restaurantId: "res_1",
  role: "WAITER" as const,
};

describe("getStaffContextOrNull", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null without a session and never hits the DB", async () => {
    vi.mocked(getStaffSession).mockResolvedValue(null);

    expect(await getStaffContextOrNull()).toBeNull();
    expect(findStaffById).not.toHaveBeenCalled();
  });

  it("returns context for an active waiter", async () => {
    vi.mocked(getStaffSession).mockResolvedValue(session);
    vi.mocked(findStaffById).mockResolvedValue(makeStaff());

    expect(await getStaffContextOrNull()).toEqual({
      staffId: "st1",
      restaurantId: "res_1",
      role: "WAITER",
      name: "Ramesh",
      employeeCode: "E1",
    });
  });

  it("locks out a deactivated / deleted / role-changed staff member instantly", async () => {
    vi.mocked(getStaffSession).mockResolvedValue(session);

    vi.mocked(findStaffById).mockResolvedValueOnce(
      makeStaff({ status: "INACTIVE" }),
    );
    expect(await getStaffContextOrNull()).toBeNull();

    vi.mocked(findStaffById).mockResolvedValueOnce(
      makeStaff({ deletedAt: new Date() }),
    );
    expect(await getStaffContextOrNull()).toBeNull();

    vi.mocked(findStaffById).mockResolvedValueOnce(
      makeStaff({ role: "MANAGEMENT" }),
    );
    expect(await getStaffContextOrNull()).toBeNull();
  });

  it("rejects a session whose restaurant no longer matches", async () => {
    vi.mocked(getStaffSession).mockResolvedValue(session);
    vi.mocked(findStaffById).mockResolvedValue(
      makeStaff({ restaurantId: "other" }),
    );

    expect(await getStaffContextOrNull()).toBeNull();
  });
});
