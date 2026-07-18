import { randomInt } from "node:crypto";

export const USERNAME_LENGTH = 7;

// Lowercase alphanumerics only — safe in URLs and easy to read/dictate.
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Generate a random 7-character lowercase alphanumeric username candidate. */
export const generateUsername = (): string => {
  let out = "";
  for (let i = 0; i < USERNAME_LENGTH; i += 1) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
};
