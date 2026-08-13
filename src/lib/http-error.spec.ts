import { describe, expect, it } from "vitest";

import { apiError, apiNoContent, apiOk, HttpError } from "./http-error";

describe("HttpError", () => {
  it("carries status, code, and optional field errors", () => {
    const err = new HttpError(400, "INVALID_INPUT", "Validation failed", {
      phone: ["required"],
    });
    expect(err.status).toBe(400);
    expect(err.code).toBe("INVALID_INPUT");
    expect(err.fieldErrors).toEqual({ phone: ["required"] });
  });
});

describe("apiOk", () => {
  it("returns 200 with a JSON body by default", async () => {
    const res = apiOk({ hello: "world" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hello: "world" });
  });

  it("honours a status override", () => {
    const res = apiOk({ ok: true }, { status: 201 });
    expect(res.status).toBe(201);
  });
});

describe("apiNoContent", () => {
  it("returns 204 with an empty body", async () => {
    const res = apiNoContent();
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });
});

describe("apiError", () => {
  it("maps HttpError to its status and code", async () => {
    const res = apiError(new HttpError(429, "OTP_LOCKED", "Too many attempts"));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({
      error: "Too many attempts",
      code: "OTP_LOCKED",
    });
  });

  it("returns 500 for unknown errors", async () => {
    const res = apiError(new Error("boom"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("INTERNAL");
  });
});
