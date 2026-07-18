import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, findUnique, findMany, update } = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { staff: { create, findUnique, findMany, update } },
}));

import {
  createStaff,
  findStaffByRestaurant,
  softDeleteStaff,
  updateStaffPin,
  type StaffWriteData,
} from "./staff.repository";

const data: StaffWriteData = {
  employeeCode: "E1",
  name: "Ramesh",
  role: "WAITER",
  status: "ACTIVE",
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
};

describe("staffRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("createStaff connects the restaurant and stores the pin hash", async () => {
    create.mockResolvedValue({ id: "st1" });

    await createStaff("res_1", data, "hash");

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        restaurant: { connect: { id: "res_1" } },
        pinHash: "hash",
        employeeCode: "E1",
      }),
    });
  });

  it("findStaffByRestaurant excludes deleted, ordered by role then name", async () => {
    findMany.mockResolvedValue([]);

    await findStaffByRestaurant("res_1");

    expect(findMany).toHaveBeenCalledWith({
      where: { restaurantId: "res_1", deletedAt: null },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
  });

  it("softDeleteStaff sets deletedAt", async () => {
    update.mockResolvedValue({});

    await softDeleteStaff("st1");

    expect(update).toHaveBeenCalledWith({
      where: { id: "st1" },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("updateStaffPin only writes the hash", async () => {
    update.mockResolvedValue({});

    await updateStaffPin("st1", "newhash");

    expect(update).toHaveBeenCalledWith({
      where: { id: "st1" },
      data: { pinHash: "newhash" },
    });
  });
});
