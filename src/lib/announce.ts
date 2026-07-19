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

/** Alert for a customer-placed self-order — e.g. "Naya self order, T1". */
export const selfOrderAlertPhrase = (o: SpeakableOrder): string =>
  o.orderType === "DINE_IN" && o.tableLabel
    ? `Naya self order, ${o.tableLabel}`
    : "Naya self order";

/** Waiter alert for a ready order — e.g. "T1 ka order taiyar hai". */
export const orderReadyPhrase = (o: SpeakableOrder): string =>
  o.orderType === "DINE_IN" && o.tableLabel
    ? `${o.tableLabel} ka order taiyar hai`
    : `Takeaway number ${o.orderNumber} taiyar hai`;

/** Per-order snapshot for alert detection: id + count of active self-order lines. */
export interface OrderAlertSignature {
  readonly id: string;
  readonly selfOrderLines: number;
}

export interface OrderAlert {
  readonly id: string;
  /** The new/added activity is a customer self-order. */
  readonly isSelfOrder: boolean;
  /** Items were added to an already-seen order (vs. a brand-new order). */
  readonly isAddOn: boolean;
}

/** Map of order id → active self-order line count, for seeding the next diff. */
export const alertSignatureMap = (
  current: readonly OrderAlertSignature[],
): Map<string, number> => new Map(current.map((o) => [o.id, o.selfOrderLines]));

/**
 * Diff the previous snapshot against the current one and return which orders
 * warrant a voice alert: any brand-new order id, plus already-seen orders whose
 * self-order line count grew (a guest adding items to their table). Staff-only
 * additions to an existing order stay silent.
 */
export const newOrderAlerts = (
  prev: ReadonlyMap<string, number>,
  current: readonly OrderAlertSignature[],
): OrderAlert[] => {
  const alerts: OrderAlert[] = [];
  for (const o of current) {
    const before = prev.get(o.id);
    if (before === undefined) {
      alerts.push({
        id: o.id,
        isSelfOrder: o.selfOrderLines > 0,
        isAddOn: false,
      });
    } else if (o.selfOrderLines > before) {
      alerts.push({ id: o.id, isSelfOrder: true, isAddOn: true });
    }
  }
  return alerts;
};
