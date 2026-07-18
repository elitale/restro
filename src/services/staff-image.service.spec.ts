import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sharp", () => {
  const chain = {
    rotate: vi.fn(() => chain),
    resize: vi.fn(() => chain),
    webp: vi.fn(() => chain),
    toBuffer: vi.fn(() => Promise.resolve(Buffer.from("webp"))),
  };
  return { default: vi.fn(() => chain) };
});
vi.mock("@/lib/storage", () => ({
  putObject: vi.fn(),
  deleteObject: vi.fn(),
  publicUrl: vi.fn((key: string) => `https://cdn.test/${key}`),
}));
vi.mock("@/repositories/staff.repository", () => ({
  findStaffById: vi.fn(),
  setStaffPhoto: vi.fn(),
}));

import { putObject } from "@/lib/storage";
import { findStaffById, setStaffPhoto } from "@/repositories/staff.repository";
import {
  IMAGE_TOO_LARGE,
  IMAGE_TYPE_INVALID,
  uploadStaffPhoto,
} from "./staff-image.service";
import { STAFF_FORBIDDEN } from "./staff.service";

const file = { buffer: Buffer.from("x"), type: "image/png", size: 100 };

describe("staff image service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads, stores a cache-busted url and sets the photo", async () => {
    vi.mocked(findStaffById).mockResolvedValue({
      id: "st1",
      restaurantId: "res_1",
      deletedAt: null,
    } as never);

    const url = await uploadStaffPhoto("res_1", "st1", file);

    expect(putObject).toHaveBeenCalledWith(
      "staff/st1/photo.webp",
      expect.any(Buffer),
      "image/webp",
    );
    expect(url).toMatch(/\?v=\d+$/);
    expect(setStaffPhoto).toHaveBeenCalledWith("st1", url);
  });

  it("rejects a photo for a staff member from another restaurant", async () => {
    vi.mocked(findStaffById).mockResolvedValue({
      id: "st1",
      restaurantId: "other",
      deletedAt: null,
    } as never);

    await expect(uploadStaffPhoto("res_1", "st1", file)).rejects.toThrow(
      STAFF_FORBIDDEN,
    );
  });

  it("rejects an invalid type and an oversized file", async () => {
    await expect(
      uploadStaffPhoto("res_1", "st1", { ...file, type: "application/pdf" }),
    ).rejects.toThrow(IMAGE_TYPE_INVALID);
    await expect(
      uploadStaffPhoto("res_1", "st1", { ...file, size: 6 * 1024 * 1024 }),
    ).rejects.toThrow(IMAGE_TOO_LARGE);
  });
});
