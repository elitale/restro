/** Presentation helpers shared across POS, Orders, KOT and invoice screens. */

/** The restaurant's display timezone. Pinned so server (RSC/UTC) and client
 *  render the same local time — no hydration flash, no UTC leaking through. */
const TIME_ZONE = "Asia/Kolkata";

export const formatCurrency = (n: number): string =>
  `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });

export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });

/** Mask a phone to its last 3 digits for display, e.g. "+919876543210" → "••210". */
export const maskPhone = (phone: string): string => {
  const last = phone.replace(/\D/g, "").slice(-3);
  return last ? `••${last}` : "";
};
