/** Presentation helpers shared across POS, Orders, KOT and invoice screens. */

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
  });

export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

/** Mask a phone to its last 3 digits for display, e.g. "+919876543210" → "••210". */
export const maskPhone = (phone: string): string => {
  const last = phone.replace(/\D/g, "").slice(-3);
  return last ? `••${last}` : "";
};
