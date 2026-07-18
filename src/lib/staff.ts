import type {
  EmploymentType,
  Gender,
  StaffRole,
  StaffStatus,
} from "@/types/staff";

export const STAFF_ROLE_OPTIONS: readonly { value: StaffRole; label: string }[] = [
  { value: "WAITER", label: "Waiter" },
  { value: "KITCHEN", label: "Kitchen" },
  { value: "MANAGEMENT", label: "Management" },
];

export const STAFF_STATUS_OPTIONS: readonly {
  value: StaffStatus;
  label: string;
}[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "ON_LEAVE", label: "On leave" },
  { value: "INACTIVE", label: "Inactive" },
];

export const EMPLOYMENT_TYPE_OPTIONS: readonly {
  value: EmploymentType;
  label: string;
}[] = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "CONTRACT", label: "Contract" },
];

export const GENDER_OPTIONS: readonly { value: Gender; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

export const staffRoleLabel = (role: StaffRole): string =>
  STAFF_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;

export const staffStatusLabel = (status: StaffStatus): string =>
  STAFF_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
