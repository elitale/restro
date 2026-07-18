import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@/lib/admin-auth", () => ({
  getAdminContextOrNull: vi.fn(),
}));

import { getAdminContextOrNull } from "@/lib/admin-auth";
import { withAdminValidation, withValidation } from "./helpers";

const schema = z.object({ name: z.string().min(1) });

describe("withValidation", () => {
  it("returns fieldErrors on invalid input", async () => {
    const handler = vi.fn();
    const action = withValidation(schema, handler);

    const result = await action({ name: "" });

    expect(result.success).toBe(false);
    expect(result.fieldErrors?.name).toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it("wraps a plain handler result in success", async () => {
    const action = withValidation(schema, async (data) => `hi ${data.name}`);

    const result = await action({ name: "Asha" });

    expect(result).toEqual({ success: true, data: "hi Asha" });
  });

  it("converts a thrown Error into a failure", async () => {
    const action = withValidation(schema, async () => {
      throw new Error("boom");
    });

    const result = await action({ name: "Asha" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("boom");
  });
});

describe("withAdminValidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forbids without an admin context", async () => {
    vi.mocked(getAdminContextOrNull).mockResolvedValue(null);
    const handler = vi.fn();
    const action = withAdminValidation(schema, handler);

    const result = await action({ name: "Asha" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Forbidden");
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes the admin context to the handler", async () => {
    vi.mocked(getAdminContextOrNull).mockResolvedValue({
      userId: "adm_1",
      role: "ADMIN",
    });
    const action = withAdminValidation(schema, async (data, ctx) => ({
      name: data.name,
      by: ctx.userId,
    }));

    const result = await action({ name: "Asha" });

    expect(result).toEqual({ success: true, data: { name: "Asha", by: "adm_1" } });
  });
});
