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

vi.mock("@/repositories/restaurant.repository", () => ({
  updateRestaurant: vi.fn(),
  createRestaurantImage: vi.fn(),
  findRestaurantImageById: vi.fn(),
  countRestaurantImages: vi.fn(),
  deleteRestaurantImage: vi.fn(),
}));

import { deleteObject, putObject } from "@/lib/storage";
import {
  countRestaurantImages,
  createRestaurantImage,
  deleteRestaurantImage,
  findRestaurantImageById,
  updateRestaurant,
} from "@/repositories/restaurant.repository";
import {
  addGalleryImage,
  GALLERY_LIMIT_REACHED,
  IMAGE_FORBIDDEN,
  IMAGE_TOO_LARGE,
  IMAGE_TYPE_INVALID,
  removeGalleryImage,
  removeLogo,
  uploadLogo,
} from "./restaurant-image.service";

const file = { buffer: Buffer.from("x"), type: "image/png", size: 100 };

describe("restaurant image service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploadLogo optimises, uploads and stores a cache-busted url", async () => {
    const url = await uploadLogo("res_1", file);

    expect(putObject).toHaveBeenCalledWith(
      "restaurants/res_1/logo.webp",
      expect.any(Buffer),
      "image/webp",
    );
    expect(url).toMatch(/^https:\/\/cdn\.test\/restaurants\/res_1\/logo\.webp\?v=\d+$/);
    expect(updateRestaurant).toHaveBeenCalledWith("res_1", { logoUrl: url });
  });

  it("removeLogo deletes the object and clears the column", async () => {
    await removeLogo("res_1");

    expect(deleteObject).toHaveBeenCalledWith("restaurants/res_1/logo.webp");
    expect(updateRestaurant).toHaveBeenCalledWith("res_1", { logoUrl: null });
  });

  it("rejects a non-image type", async () => {
    await expect(
      uploadLogo("res_1", { ...file, type: "application/pdf" }),
    ).rejects.toThrow(IMAGE_TYPE_INVALID);
  });

  it("rejects an oversized file", async () => {
    await expect(
      uploadLogo("res_1", { ...file, size: 6 * 1024 * 1024 }),
    ).rejects.toThrow(IMAGE_TOO_LARGE);
  });

  it("addGalleryImage enforces the 8-image cap", async () => {
    vi.mocked(countRestaurantImages).mockResolvedValue(8);

    await expect(addGalleryImage("res_1", file)).rejects.toThrow(
      GALLERY_LIMIT_REACHED,
    );
    expect(createRestaurantImage).not.toHaveBeenCalled();
  });

  it("addGalleryImage records an image when under the cap", async () => {
    vi.mocked(countRestaurantImages).mockResolvedValue(2);

    await addGalleryImage("res_1", file);

    expect(createRestaurantImage).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: "res_1", sortOrder: 2 }),
    );
  });

  it("removeGalleryImage rejects an image from another restaurant", async () => {
    vi.mocked(findRestaurantImageById).mockResolvedValue({
      id: "gi1",
      restaurantId: "other",
      storageKey: "restaurants/other/gallery-x.webp",
    } as unknown as Awaited<ReturnType<typeof findRestaurantImageById>>);

    await expect(removeGalleryImage("res_1", "gi1")).rejects.toThrow(
      IMAGE_FORBIDDEN,
    );
    expect(deleteRestaurantImage).not.toHaveBeenCalled();
  });
});
