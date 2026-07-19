import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({ getAdminContextOrNull: vi.fn() }));
vi.mock("@/lib/manager-auth", () => ({ getManagerContextOrNull: vi.fn() }));
vi.mock("@/lib/staff-auth", () => ({ getStaffContextOrNull: vi.fn() }));
vi.mock("@/services/table.service", () => ({
  createTable: vi.fn(),
  updateTable: vi.fn(),
  deleteTable: vi.fn(),
}));

import { getManagerContextOrNull } from "@/lib/manager-auth";
import { createTable, deleteTable } from "@/services/table.service";
import {
  createTableAction,
  deleteTableAction,
} from "./table.actions";

const CTX = { userId: "u1", restaurantId: "res_1" };

describe("table actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getManagerContextOrNull).mockResolvedValue(CTX);
  });

  it("createTableAction delegates with the manager context", async () => {
    const result = await createTableAction({ label: "T1" });

    expect(result.success).toBe(true);
    expect(createTable).toHaveBeenCalledWith(
      CTX,
      expect.objectContaining({ label: "T1" }),
    );
  });

  it("createTableAction rejects a blank label", async () => {
    const result = await createTableAction({ label: "" });

    expect(result.success).toBe(false);
    expect(result.fieldErrors).toBeDefined();
    expect(createTable).not.toHaveBeenCalled();
  });

  it("deleteTableAction delegates the id", async () => {
    const result = await deleteTableAction({ id: "t1" });

    expect(result.success).toBe(true);
    expect(deleteTable).toHaveBeenCalledWith(CTX, { id: "t1" });
  });

  it("returns NO_RESTAURANT when the manager has no restaurant", async () => {
    vi.mocked(getManagerContextOrNull).mockResolvedValue(null);

    const result = await createTableAction({ label: "T1" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("NO_RESTAURANT");
  });
});
