import type { CartLine } from "@/components/pos/types";

const PREFIX = "restro.guestsession";
const TTL_MS = 2 * 60 * 60 * 1000; // 2h — matches the guest cookie

export interface GuestSession {
  readonly lines: CartLine[];
  readonly verified: boolean;
  /** Session auto-expiry (epoch ms); after this the guest is treated as logged out. */
  readonly expiresAt: number | null;
  readonly updatedAt: number;
}

/** Per-restaurant + per-table storage key so a different QR never restores the wrong cart. */
export const guestSessionKey = (username: string, tableId: string): string =>
  `${PREFIX}.${username}.${tableId}`;

/**
 * Pure: parse a stored blob, returning it only when well-formed and unexpired.
 * `verified` is additionally cleared once the session's own `expiresAt` passes
 * (so cart activity can't keep a stale login alive). Kept IO-free for tests.
 */
export const parseGuestSession = (
  raw: string | null,
  now: number,
): GuestSession | null => {
  if (!raw) {
    return null;
  }
  try {
    const data = JSON.parse(raw) as Partial<GuestSession>;
    if (typeof data.updatedAt !== "number" || now - data.updatedAt > TTL_MS) {
      return null;
    }
    if (!Array.isArray(data.lines)) {
      return null;
    }
    const expiresAt =
      typeof data.expiresAt === "number" ? data.expiresAt : null;
    const verified =
      Boolean(data.verified) && (expiresAt === null || now < expiresAt);
    return {
      lines: data.lines as CartLine[],
      verified,
      expiresAt,
      updatedAt: data.updatedAt,
    };
  } catch {
    return null;
  }
};

/** Read the saved session for a key, pruning it if missing/expired. */
export const readGuestSession = (key: string): GuestSession | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const parsed = parseGuestSession(window.localStorage.getItem(key), Date.now());
  if (!parsed) {
    window.localStorage.removeItem(key);
  }
  return parsed;
};

/** Persist the current cart draft + verified marker (stamped with `now`). */
export const writeGuestSession = (
  key: string,
  session: {
    readonly lines: CartLine[];
    readonly verified: boolean;
    readonly expiresAt: number | null;
  },
): void => {
  if (typeof window === "undefined") {
    return;
  }
  const payload: GuestSession = { ...session, updatedAt: Date.now() };
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Storage full or disabled (private mode) — persistence is best-effort.
  }
};

export const clearGuestSession = (key: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(key);
};
