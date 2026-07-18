import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MenuItemImage } from "@/generated/prisma/client";

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

vi.mock("@/repositories/menu-item-image.repository", () => ({
  countImagesForItem: vi.fn(),
  createMenuItemImage: vi.fn(),
  findMenuItemImageById: vi.fn(),
  deleteMenuItemImage: vi.fn(),
}));

vi.mock("@/repositories/menu-item.repository", () => ({
  findMenuItemOwnership: vi.fn(),
}));

import { deleteObject, putObject } from "@/lib/storage";
import { findMenuItemOwnership } from "@/repositories/menu-item.repository";
import {
  countImagesForItem,
  createMenuItemImage,
  deleteMenuItemImage,
  findMenuItemImageById,
} from "@/repositories/menu-item-image.repository";
import {
  addItemImage,
  addItemImageForRestaurant,
  IMAGE_LIMIT_REACHED,
  IMAGE_NOT_FOUND,
  IMAGE_TOO_LARGE,
  IMAGE_TYPE_INVALID,
  MENU_FORBIDDEN,
  removeItemImage,
  removeItemImageForRestaurant,
} from "./menu-image.service";

const makeImage = (overrides: Partial<MenuItemImage> = {}): MenuItemImage => ({
  id: "img_1",
  menuItemId: "i1",
  url: "https://cdn.test/k",
  storageKey: "menu-items/i1/k.webp",
  isPrimary: true,
  sortOrder: 0,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const file = (overrides: Partial<{ type: string; size: number }> = {}) => ({
  buffer: Buffer.from("x"),
  type: "image/jpeg",
  size: 1000,
  ...overrides,
});

describe("addItemImage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an unsupported file type", async () => {
    await expect(
      addItemImage("i1", file({ type: "application/pdf" })),
    ).rejects.toThrow(IMAGE_TYPE_INVALID);
    expect(putObject).not.toHaveBeenCalled();
  });

  it("rejects a file over the size cap", async () => {
    await expect(
      addItemImage("i1", file({ size: 99 * 1024 * 1024 })),
    ).rejects.toThrow(IMAGE_TOO_LARGE);
  });

  it("rejects when the per-item image limit is reached", async () => {
    vi.mocked(countImagesForItem).mockResolvedValue(3);
    await expect(addItemImage("i1", file())).rejects.toThrow(
      IMAGE_LIMIT_REACHED,
    );
  });

  it("optimises, uploads, and records the first image as primary", async () => {
    vi.mocked(countImagesForItem).mockResolvedValue(0);
    vi.mocked(createMenuItemImage).mockResolvedValue(makeImage());

    await addItemImage("i1", file());

    expect(putObject).toHaveBeenCalledTimes(1);
    expect(createMenuItemImage).toHaveBeenCalledWith(
      expect.objectContaining({ menuItemId: "i1", isPrimary: true, sortOrder: 0 }),
    );
  });

  it("marks a subsequent image as non-primary", async () => {
    vi.mocked(countImagesForItem).mockResolvedValue(1);
    vi.mocked(createMenuItemImage).mockResolvedValue(
      makeImage({ isPrimary: false, sortOrder: 1 }),
    );

    await addItemImage("i1", file());

    expect(createMenuItemImage).toHaveBeenCalledWith(
      expect.objectContaining({ isPrimary: false, sortOrder: 1 }),
    );
  });
});

describe("removeItemImage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the storage object and the row", async () => {
    vi.mocked(findMenuItemImageById).mockResolvedValue(makeImage());

    await removeItemImage("img_1");

    expect(deleteObject).toHaveBeenCalledWith("menu-items/i1/k.webp");
    expect(deleteMenuItemImage).toHaveBeenCalledWith("img_1");
  });

  it("throws when the image is missing", async () => {
    vi.mocked(findMenuItemImageById).mockResolvedValue(null);
    await expect(removeItemImage("nope")).rejects.toThrow(IMAGE_NOT_FOUND);
  });
});

describe("ownership wrappers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("addItemImageForRestaurant rejects an item from another restaurant", async () => {
    vi.mocked(findMenuItemOwnership).mockResolvedValue({ restaurantId: "other" });

    await expect(
      addItemImageForRestaurant("res_1", "i1", file()),
    ).rejects.toThrow(MENU_FORBIDDEN);
    expect(putObject).not.toHaveBeenCalled();
  });

  it("removeItemImageForRestaurant deletes when owned", async () => {
    vi.mocked(findMenuItemImageById).mockResolvedValue(makeImage());
    vi.mocked(findMenuItemOwnership).mockResolvedValue({ restaurantId: "res_1" });

    await removeItemImageForRestaurant("res_1", "img_1");

    expect(deleteObject).toHaveBeenCalledWith("menu-items/i1/k.webp");
    expect(deleteMenuItemImage).toHaveBeenCalledWith("img_1");
  });
});
