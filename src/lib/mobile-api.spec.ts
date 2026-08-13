import { describe, expect, it } from "vitest";
import { z } from "zod";

import { HttpError } from "@/lib/http-error";
import { withMobileJsonRoute } from "@/lib/mobile-api";
import {
    MOBILE_MULTI_RESTAURANT_UNSUPPORTED,
    MOBILE_OTP_EXPIRED,
    MOBILE_OTP_INVALID,
    MOBILE_OTP_LOCKED,
    MOBILE_OTP_RATE_LIMITED,
    MOBILE_PIN_INVALID,
    MOBILE_PIN_LOCKED,
    MOBILE_PIN_NOT_SET,
    MOBILE_USER_NOT_FOUND,
} from "@/services/mobile-auth.service";

const schema = z.object({ name: z.string().min(1) });

const makeReq = (body: unknown): Request =>
  new Request("http://localhost/x", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

const call = <T>(handler: (data: z.infer<typeof schema>) => Promise<T>) =>
  withMobileJsonRoute(schema, handler);

describe("withMobileJsonRoute", () => {
  it("returns the handler payload on success", async () => {
    const route = call(async ({ name }) => ({ hello: name }));
    const res = await route(
      makeReq({
        name: "world",
      }) as unknown as import("next/server").NextRequest,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hello: "world" });
  });

  it("returns 400 INVALID_INPUT with per-field errors on Zod failure", async () => {
    const route = call(async () => ({ ok: true }));
    const res = await route(
      makeReq({ name: "" }) as unknown as import("next/server").NextRequest,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_INPUT");
    expect(body.fieldErrors?.name).toBeDefined();
  });

  it("re-throws HttpError as-is", async () => {
    const route = call(async () => {
      throw new HttpError(418, "TEAPOT", "I'm a teapot");
    });
    const res = await route(
      makeReq({ name: "x" }) as unknown as import("next/server").NextRequest,
    );
    expect(res.status).toBe(418);
    expect((await res.json()).code).toBe("TEAPOT");
  });

  it.each([
    [MOBILE_USER_NOT_FOUND, 404, "USER_NOT_FOUND"],
    [MOBILE_MULTI_RESTAURANT_UNSUPPORTED, 409, "MULTI_RESTAURANT_UNSUPPORTED"],
    [MOBILE_OTP_RATE_LIMITED, 429, "RATE_LIMITED"],
    [MOBILE_OTP_EXPIRED, 410, "OTP_EXPIRED"],
    [MOBILE_OTP_INVALID, 400, "INVALID_CODE"],
    [MOBILE_OTP_LOCKED, 429, "OTP_LOCKED"],
    [MOBILE_PIN_INVALID, 400, "INVALID_PIN"],
    [MOBILE_PIN_LOCKED, 423, "PIN_LOCKED"],
    [MOBILE_PIN_NOT_SET, 403, "PIN_NOT_SET"],
  ])("maps %s to HTTP %i with code %s", async (domainError, status, code) => {
    const route = call(async () => {
      throw new Error(domainError);
    });
    const res = await route(
      makeReq({ name: "x" }) as unknown as import("next/server").NextRequest,
    );
    expect(res.status).toBe(status);
    expect((await res.json()).code).toBe(code);
  });

  it("returns 500 INTERNAL for an unknown error", async () => {
    const route = call(async () => {
      throw new Error("SOMETHING_UNMAPPED");
    });
    const res = await route(
      makeReq({ name: "x" }) as unknown as import("next/server").NextRequest,
    );
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("INTERNAL");
  });

  it("treats a body that is not valid JSON as an empty object", async () => {
    const route = call(async () => ({ ok: true }));
    const badReq = new Request("http://localhost/x", {
      method: "POST",
      body: "not-json",
    });
    const res = await route(
      badReq as unknown as import("next/server").NextRequest,
    );
    // Empty object fails the `name` requirement → 400 with field errors.
    expect(res.status).toBe(400);
  });
});
