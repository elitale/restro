import type { BusinessHoursDTO } from "@/types/settings";

export const DAY_LABELS: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

/** Display order — Monday first. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const DEFAULT_BUSINESS_HOURS: BusinessHoursDTO[] = [
  0, 1, 2, 3, 4, 5, 6,
].map((day) => ({ day, isClosed: false, opensAt: "11:00", closesAt: "23:00" }));
