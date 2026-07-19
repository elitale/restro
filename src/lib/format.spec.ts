import { describe, expect, it } from "vitest";

import { formatDateTime, formatTime, maskPhone } from "./format";

describe("formatTime", () => {
  it("renders in IST, not UTC", () => {
    // 00:00 UTC is 05:30 IST — the display must show the local (IST) time.
    expect(formatTime("2026-01-01T00:00:00.000Z")).toContain("05:30");
  });
});

describe("formatDateTime", () => {
  it("renders the date + time in IST across a day rollover", () => {
    // 20:00 UTC on Jan 1 is 01:30 IST on Jan 2.
    const out = formatDateTime("2026-01-01T20:00:00.000Z");
    expect(out).toContain("02 Jan");
    expect(out).toContain("01:30");
  });
});

describe("maskPhone", () => {
  it("shows only the last 3 digits", () => {
    expect(maskPhone("+919876543210")).toBe("••210");
  });

  it("ignores non-digit characters", () => {
    expect(maskPhone("+91 98765 43210")).toBe("••210");
  });

  it("returns empty for a value with no digits", () => {
    expect(maskPhone("")).toBe("");
  });
});
