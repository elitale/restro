import type { OrderType } from "@/types/order";

/** Minimal order shape needed to build a spoken announcement. */
export interface SpeakableOrder {
  readonly orderType: OrderType;
  readonly tableLabel: string | null;
  readonly orderNumber: number;
}

/**
 * Pick the best available Hindi voice for announcements: an exact `hi-IN`
 * voice when present, else any `hi-*` voice, else `null` (caller falls back to
 * the browser default with `lang = "hi-IN"`).
 */
export const pickHindiVoice = (
  voices: readonly SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null => {
  const hindi = voices.filter((v) => v.lang?.toLowerCase().startsWith("hi"));
  if (hindi.length === 0) {
    return null;
  }
  return hindi.find((v) => v.lang.toLowerCase() === "hi-in") ?? hindi[0];
};

/** Ids present in `current` that are not already in `seen`. */
export const newIds = (
  seen: ReadonlySet<string>,
  current: readonly string[],
): string[] => current.filter((id) => !seen.has(id));

/** Kitchen alert for a fresh ticket — e.g. "Naya order, T1". */
export const newOrderPhrase = (o: SpeakableOrder): string =>
  o.orderType === "DINE_IN" && o.tableLabel
    ? `Naya order, ${o.tableLabel}`
    : `Naya ${o.orderType === "DELIVERY" ? "delivery" : "takeaway"} order`;

/** Waiter alert for a ready order — e.g. "T1 ka order taiyar hai". */
export const orderReadyPhrase = (o: SpeakableOrder): string =>
  o.orderType === "DINE_IN" && o.tableLabel
    ? `${o.tableLabel} ka order taiyar hai`
    : `Takeaway number ${o.orderNumber} taiyar hai`;
