import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      store.has(name) ? { value: store.get(name) } : undefined,
    set: (name: string, value: string) => {
      store.set(name, value);
    },
    delete: (name: string) => {
      store.delete(name);
    },
  }),
}));

import {
  createGuestSession,
  destroyGuestSession,
  getGuestSession,
} from "./guest-session";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-value";
});
beforeEach(() => store.clear());

describe("guest session", () => {
  it("round-trips a signed session", async () => {
    await createGuestSession({
      restaurantId: "res_1",
      tableId: "t1",
      phone: "+919876543210",
    });

    expect(await getGuestSession()).toEqual({
      restaurantId: "res_1",
      tableId: "t1",
      phone: "+919876543210",
    });
  });

  it("returns null when there's no cookie", async () => {
    expect(await getGuestSession()).toBeNull();
  });

  it("returns null for a tampered token", async () => {
    store.set("restro_guest", "not.a.jwt");

    expect(await getGuestSession()).toBeNull();
  });

  it("clears the cookie on destroy", async () => {
    await createGuestSession({
      restaurantId: "res_1",
      tableId: "t1",
      phone: "+919876543210",
    });
    await destroyGuestSession();

    expect(await getGuestSession()).toBeNull();
  });
});
