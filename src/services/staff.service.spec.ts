import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Staff } from "@/generated/prisma/client";

vi.mock("@/lib/staff-pin", () => ({
  hashStaffPin: (pin: string, restaurantId: string) => `h:${restaurantId}:${pin}`,
}));
vi.mock("@/repositories/staff.repository", () => ({
  createStaff: vi.fn(),
  findStaffByEmployeeCode: vi.fn(),
  findStaffById: vi.fn(),
  findStaffByPinHash: vi.fn(),
  findStaffByRestaurant: vi.fn(),
  reviveStaff: vi.fn(),
  softDeleteStaff: vi.fn(),
  updateStaff: vi.fn(),
  updateStaffPin: vi.fn(),
}));

import {
  createStaff as createStaffRepo,
  findStaffByEmployeeCode,
  findStaffById,
  findStaffByPinHash,
  reviveStaff,
  updateStaffPin,
} from "@/repositories/staff.repository";
import {
  createStaff,
  mapStaff,
  resetPin,
  STAFF_CODE_TAKEN,
  STAFF_FORBIDDEN,
  STAFF_PIN_TAKEN,
  updateStaff,
} from "./staff.service";

const ctx = { restaurantId: "res_1", userId: "u1" };

const makeStaff = (o: Record<string, unknown> = {}): Staff =>
  ({
    id: "st1",
    restaurantId: "res_1",
    employeeCode: "E1",
    name: "Ramesh",
    role: "WAITER",
    status: "ACTIVE",
    photoUrl: null,
    phone: "999",
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
    pinHash: "h:res_1:1234",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...o,
  }) as unknown as Staff;

const baseInput = {
  employeeCode: "E9",
  name: "New",
  role: "WAITER" as const,
  status: "ACTIVE" as const,
  phone: "888",
  pin: "1234",
};

describe("mapStaff", () => {
  it("never leaks the pin hash and exposes hasPin", () => {
    const dto = mapStaff(makeStaff());
    expect(dto.hasPin).toBe(true);
    expect(dto).not.toHaveProperty("pinHash");
  });
});

describe("createStaff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createStaffRepo).mockResolvedValue(makeStaff({ id: "new" }));
  });

  it("hashes the pin and creates a new staff member", async () => {
    vi.mocked(findStaffByEmployeeCode).mockResolvedValue(null);
    vi.mocked(findStaffByPinHash).mockResolvedValue(null);

    await createStaff(ctx, baseInput);

    expect(createStaffRepo).toHaveBeenCalledWith(
      "res_1",
      expect.objectContaining({ employeeCode: "E9" }),
      "h:res_1:1234",
    );
  });

  it("rejects a duplicate active employee code", async () => {
    vi.mocked(findStaffByEmployeeCode).mockResolvedValue(makeStaff());
    vi.mocked(findStaffByPinHash).mockResolvedValue(null);

    await expect(createStaff(ctx, baseInput)).rejects.toThrow(STAFF_CODE_TAKEN);
  });

  it("rejects a pin already used by another active staff", async () => {
    vi.mocked(findStaffByEmployeeCode).mockResolvedValue(null);
    vi.mocked(findStaffByPinHash).mockResolvedValue(makeStaff({ id: "other" }));

    await expect(createStaff(ctx, baseInput)).rejects.toThrow(STAFF_PIN_TAKEN);
    expect(createStaffRepo).not.toHaveBeenCalled();
  });

  it("revives a soft-deleted employee code", async () => {
    vi.mocked(findStaffByEmployeeCode).mockResolvedValue(
      makeStaff({ id: "old", deletedAt: new Date() }),
    );
    vi.mocked(findStaffByPinHash).mockResolvedValue(null);
    vi.mocked(reviveStaff).mockResolvedValue(makeStaff({ id: "old" }));

    await createStaff(ctx, baseInput);

    expect(reviveStaff).toHaveBeenCalled();
    expect(createStaffRepo).not.toHaveBeenCalled();
  });
});

describe("updateStaff / resetPin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects updating a staff member from another restaurant", async () => {
    vi.mocked(findStaffById).mockResolvedValue(makeStaff({ restaurantId: "x" }));

    await expect(
      updateStaff(ctx, { ...baseInput, id: "st1" }),
    ).rejects.toThrow(STAFF_FORBIDDEN);
  });

  it("resetPin hashes and writes the new pin when free", async () => {
    vi.mocked(findStaffById).mockResolvedValue(makeStaff());
    vi.mocked(findStaffByPinHash).mockResolvedValue(null);

    await resetPin(ctx, { id: "st1", pin: "9999" });

    expect(updateStaffPin).toHaveBeenCalledWith("st1", "h:res_1:9999");
  });
});
