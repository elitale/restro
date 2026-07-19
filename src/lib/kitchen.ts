export type KitchenStatus = "WAITING" | "PREPARING" | "READY";

/** Line states that are "live" in the kitchen (on the KDS board). */
export const KITCHEN_ACTIVE_STATES = ["FIRED", "PREPARING", "PREPARED"] as const;

export const KITCHEN_STATUS_LABEL: Record<KitchenStatus, string> = {
  WAITING: "Waiting",
  PREPARING: "Preparing",
  READY: "Ready",
};

const isActive = (state: string): boolean =>
  (KITCHEN_ACTIVE_STATES as readonly string[]).includes(state);

/**
 * Derive a ticket's kitchen status from its line states.
 * `null` = no active kitchen lines (nothing to prepare / all served).
 */
export const deriveKitchenStatus = (
  states: readonly string[],
): KitchenStatus | null => {
  const active = states.filter(isActive);
  if (active.length === 0) {
    return null;
  }
  if (active.every((s) => s === "PREPARED")) {
    return "READY";
  }
  if (active.every((s) => s === "FIRED")) {
    return "WAITING";
  }
  return "PREPARING";
};

/** The kitchen's next-step button label, or `null` when everything is prepared. */
export const kitchenAdvanceLabel = (
  states: readonly string[],
): string | null => {
  if (states.some((s) => s === "FIRED")) {
    return "Start";
  }
  if (states.some((s) => s === "PREPARING")) {
    return "Mark ready";
  }
  return null;
};
