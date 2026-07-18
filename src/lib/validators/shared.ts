import { z } from "zod";

/** E.164 phone number, e.g. +919876543210 — the primary identifier for a manager. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    "Enter phone in international format, e.g. +919876543210",
  );

/** Normalised (trimmed + lowercased) email address. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

/** Non-empty identifier. */
export const idSchema = z.string().min(1, "Invalid id");

/** Human name, trimmed and length-bounded. */
export const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(120, "Name must be 120 characters or fewer");
