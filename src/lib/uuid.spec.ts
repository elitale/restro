import { describe, expect, it } from "vitest";

import { randomV4, uuid } from "./uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("randomV4", () => {
  it("produces a canonical v4 UUID", () => {
    expect(randomV4()).toMatch(V4);
  });

  it("is unique across calls", () => {
    expect(randomV4()).not.toBe(randomV4());
  });
});

describe("uuid", () => {
  it("produces a v4 UUID", () => {
    expect(uuid()).toMatch(V4);
  });
});
