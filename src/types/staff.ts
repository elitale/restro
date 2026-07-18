export type StaffRole = "WAITER" | "KITCHEN" | "MANAGEMENT";
export type StaffStatus = "ACTIVE" | "ON_LEAVE" | "INACTIVE";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT";
export type Gender = "MALE" | "FEMALE" | "OTHER";

export interface StaffDTO {
  readonly id: string;
  readonly employeeCode: string;
  readonly name: string;
  readonly role: StaffRole;
  readonly status: StaffStatus;
  readonly photoUrl: string | null;
  readonly phone: string;
  readonly email: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly postalCode: string | null;
  readonly dateOfBirth: string | null;
  readonly gender: Gender | null;
  readonly joiningDate: string | null;
  readonly employmentType: EmploymentType | null;
  readonly emergencyContactName: string | null;
  readonly emergencyContactPhone: string | null;
  readonly notes: string | null;
  readonly hasPin: boolean;
}
