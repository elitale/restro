import { describe, expect, it } from "vitest";

import { deriveKitchenStatus, kitchenAdvanceLabel } from "@/lib/kitchen";

describe("deriveKitchenStatus", () => {
  it("returns null when no lines are active in the kitchen", () => {
    expect(deriveKitchenStatus(["SERVED", "VOID", "UNSENT"])).toBeNull();
    expect(deriveKitchenStatus([])).toBeNull();
  });

  it("is WAITING when every active line is still fired", () => {
    expect(deriveKitchenStatus(["FIRED", "FIRED", "SERVED"])).toBe("WAITING");
  });

  it("is READY when every active line is prepared", () => {
    expect(deriveKitchenStatus(["PREPARED", "PREPARED", "VOID"])).toBe("READY");
  });

  it("is PREPARING for any in-progress mix", () => {
    expect(deriveKitchenStatus(["FIRED", "PREPARING"])).toBe("PREPARING");
    expect(deriveKitchenStatus(["PREPARING", "PREPARED"])).toBe("PREPARING");
    expect(deriveKitchenStatus(["FIRED", "PREPARED"])).toBe("PREPARING");
  });

  it("ignores non-kitchen line states", () => {
    expect(deriveKitchenStatus(["UNSENT", "FIRED"])).toBe("WAITING");
  });
});

describe("kitchenAdvanceLabel", () => {
  it("is Start while any line is fired", () => {
    expect(kitchenAdvanceLabel(["FIRED", "PREPARING"])).toBe("Start");
  });

  it("is Mark ready once only preparing lines remain", () => {
    expect(kitchenAdvanceLabel(["PREPARING", "PREPARED"])).toBe("Mark ready");
  });

  it("is null when everything is prepared", () => {
    expect(kitchenAdvanceLabel(["PREPARED", "PREPARED"])).toBeNull();
  });
});
