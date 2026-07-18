import { describe, expect, it } from "vitest";

import { generateUsername, USERNAME_LENGTH } from "./username";

describe("generateUsername", () => {
  it("produces a 7-character lowercase alphanumeric string", () => {
    for (let i = 0; i < 50; i += 1) {
      const username = generateUsername();
      expect(username).toHaveLength(USERNAME_LENGTH);
      expect(username).toMatch(/^[a-z0-9]{7}$/);
    }
  });

  it("is not deterministic across calls", () => {
    const values = new Set(
      Array.from({ length: 20 }, () => generateUsername()),
    );
    expect(values.size).toBeGreaterThan(1);
  });
});
