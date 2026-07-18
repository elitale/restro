import type {
  EmploymentType,
  Gender,
  Staff,
  StaffRole,
  StaffStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export interface StaffWriteData {
  employeeCode: string;
  name: string;
  role: StaffRole;
  status: StaffStatus;
  phone: string;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  dateOfBirth: Date | null;
  gender: Gender | null;
  joiningDate: Date | null;
  employmentType: EmploymentType | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
}

export const createStaff = (
  restaurantId: string,
  data: StaffWriteData,
  pinHash: string,
): Promise<Staff> =>
  prisma.staff.create({
    data: { restaurant: { connect: { id: restaurantId } }, pinHash, ...data },
  });

export const updateStaff = (id: string, data: StaffWriteData): Promise<Staff> =>
  prisma.staff.update({ where: { id }, data });

export const reviveStaff = (
  id: string,
  data: StaffWriteData,
  pinHash: string,
): Promise<Staff> =>
  prisma.staff.update({
    where: { id },
    data: { ...data, pinHash, deletedAt: null },
  });

export const softDeleteStaff = (id: string): Promise<Staff> =>
  prisma.staff.update({ where: { id }, data: { deletedAt: new Date() } });

export const updateStaffPin = (id: string, pinHash: string): Promise<Staff> =>
  prisma.staff.update({ where: { id }, data: { pinHash } });

export const setStaffPhoto = (
  id: string,
  photoUrl: string | null,
): Promise<Staff> =>
  prisma.staff.update({ where: { id }, data: { photoUrl } });

export const findStaffById = (id: string): Promise<Staff | null> =>
  prisma.staff.findUnique({ where: { id } });

export const findStaffByEmployeeCode = (
  restaurantId: string,
  employeeCode: string,
): Promise<Staff | null> =>
  prisma.staff.findUnique({
    where: { restaurantId_employeeCode: { restaurantId, employeeCode } },
  });

export const findStaffByPinHash = (
  restaurantId: string,
  pinHash: string,
): Promise<Staff | null> =>
  prisma.staff.findUnique({
    where: { restaurantId_pinHash: { restaurantId, pinHash } },
  });

export const findStaffByRestaurant = (
  restaurantId: string,
): Promise<Staff[]> =>
  prisma.staff.findMany({
    where: { restaurantId, deletedAt: null },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
