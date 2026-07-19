import { describe, expect, it } from "vitest";

import {
  newIds,
  newOrderPhrase,
  orderReadyPhrase,
  pickHindiVoice,
  type SpeakableOrder,
} from "./announce";

const voice = (lang: string, name = lang): SpeechSynthesisVoice =>
  ({
    lang,
    name,
    default: false,
    localService: true,
    voiceURI: name,
  }) as SpeechSynthesisVoice;

describe("pickHindiVoice", () => {
  it("prefers an exact hi-IN voice", () => {
    const v = pickHindiVoice([voice("en-US"), voice("hi"), voice("hi-IN")]);
    expect(v?.lang).toBe("hi-IN");
  });

  it("falls back to any hi-* voice", () => {
    expect(pickHindiVoice([voice("en-US"), voice("hi")])?.lang).toBe("hi");
  });

  it("returns null when no Hindi voice exists", () => {
    expect(pickHindiVoice([voice("en-US"), voice("fr-FR")])).toBeNull();
  });
});

describe("newIds", () => {
  it("returns only ids not already seen", () => {
    expect(newIds(new Set(["a", "b"]), ["b", "c", "d"])).toEqual(["c", "d"]);
  });

  it("returns empty when nothing is new", () => {
    expect(newIds(new Set(["a"]), ["a"])).toEqual([]);
  });
});

const order = (over: Partial<SpeakableOrder> = {}): SpeakableOrder => ({
  orderType: "DINE_IN",
  tableLabel: "T1",
  orderNumber: 7,
  ...over,
});

describe("newOrderPhrase", () => {
  it("names the table for dine-in", () => {
    expect(newOrderPhrase(order())).toBe("Naya order, T1");
  });

  it("uses a generic phrase for takeaway", () => {
    expect(
      newOrderPhrase(order({ orderType: "TAKEAWAY", tableLabel: null })),
    ).toBe("Naya takeaway order");
  });

  it("uses a delivery phrase for delivery", () => {
    expect(
      newOrderPhrase(order({ orderType: "DELIVERY", tableLabel: null })),
    ).toBe("Naya delivery order");
  });
});

describe("orderReadyPhrase", () => {
  it("announces the table for dine-in", () => {
    expect(orderReadyPhrase(order())).toBe("T1 ka order taiyar hai");
  });

  it("announces the number for takeaway", () => {
    expect(
      orderReadyPhrase(order({ orderType: "TAKEAWAY", tableLabel: null })),
    ).toBe("Takeaway number 7 taiyar hai");
  });
});
