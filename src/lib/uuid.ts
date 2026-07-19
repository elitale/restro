/**
 * RFC 4122 v4 UUID generation from `crypto.getRandomValues`. Unlike
 * `crypto.randomUUID`, `getRandomValues` is available in **insecure** contexts
 * too (e.g. plain HTTP on a LAN IP), where `randomUUID` is `undefined`.
 */
export function randomV4(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // version 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * A v4 UUID that works everywhere. Prefers the native `crypto.randomUUID`
 * (secure contexts / Node) and falls back to `randomV4` on insecure origins,
 * where `crypto.randomUUID` is not defined and would throw.
 */
export function uuid(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : randomV4();
}
