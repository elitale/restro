import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminUserRow } from "@/repositories/user.repository";

vi.mock("@/repositories/user.repository", () => ({
  findUsersPaginated: vi.fn(),
}));

import { findUsersPaginated } from "@/repositories/user.repository";
import { listUsers } from "./admin-user.service";

const makeRow = (overrides: Partial<AdminUserRow> = {}): AdminUserRow => ({
  id: "usr_1",
  name: "Asha",
  phone: "+919876543210",
  email: null,
  role: "MANAGER",
  suspendedAt: null,
  deletedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  _count: { ownedRestaurants: 2 },
  ...overrides,
});

describe("listUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps rows to DTOs with derived status + counts", async () => {
    vi.mocked(findUsersPaginated).mockResolvedValue({
      items: [
        makeRow(),
        makeRow({
          id: "usr_2",
          suspendedAt: new Date("2026-02-01T00:00:00.000Z"),
          _count: { ownedRestaurants: 0 },
        }),
      ],
      total: 2,
    });

    const result = await listUsers({ page: 1, pageSize: 20 });

    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.items[0]).toEqual({
      id: "usr_1",
      name: "Asha",
      phone: "+919876543210",
      email: null,
      role: "MANAGER",
      status: "active",
      restaurantCount: 2,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.items[1]?.status).toBe("suspended");
  });
});
