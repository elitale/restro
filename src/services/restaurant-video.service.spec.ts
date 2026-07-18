import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage", () => ({
  putObject: vi.fn(),
  deleteObject: vi.fn(),
  publicUrl: vi.fn((key: string) => `https://cdn.test/${key}`),
}));

vi.mock("@/repositories/restaurant.repository", () => ({
  countRestaurantVideos: vi.fn(),
  createRestaurantVideo: vi.fn(),
  findRestaurantVideoById: vi.fn(),
  deleteRestaurantVideo: vi.fn(),
}));

import { deleteObject, putObject } from "@/lib/storage";
import {
  countRestaurantVideos,
  createRestaurantVideo,
  deleteRestaurantVideo,
  findRestaurantVideoById,
} from "@/repositories/restaurant.repository";
import {
  addVideoLink,
  removeVideo,
  uploadVideoFile,
  VIDEO_FORBIDDEN,
  VIDEO_LIMIT_REACHED,
  VIDEO_TOO_LARGE,
  VIDEO_TYPE_INVALID,
} from "./restaurant-video.service";

const videoFile = { buffer: Buffer.from("x"), type: "video/mp4", size: 1000 };

describe("restaurant video service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("addVideoLink records a LINK video at the next slot", async () => {
    vi.mocked(countRestaurantVideos).mockResolvedValue(2);

    await addVideoLink("res_1", "https://youtu.be/abc", "Our story");

    expect(createRestaurantVideo).toHaveBeenCalledWith({
      restaurantId: "res_1",
      kind: "LINK",
      url: "https://youtu.be/abc",
      storageKey: null,
      caption: "Our story",
      sortOrder: 2,
    });
  });

  it("rejects adding a video past the 6-video cap", async () => {
    vi.mocked(countRestaurantVideos).mockResolvedValue(6);

    await expect(
      addVideoLink("res_1", "https://youtu.be/abc"),
    ).rejects.toThrow(VIDEO_LIMIT_REACHED);
    expect(createRestaurantVideo).not.toHaveBeenCalled();
  });

  it("uploadVideoFile rejects a non-video type", async () => {
    await expect(
      uploadVideoFile("res_1", { ...videoFile, type: "image/png" }),
    ).rejects.toThrow(VIDEO_TYPE_INVALID);
  });

  it("uploadVideoFile rejects an oversized file", async () => {
    await expect(
      uploadVideoFile("res_1", { ...videoFile, size: 26 * 1024 * 1024 }),
    ).rejects.toThrow(VIDEO_TOO_LARGE);
  });

  it("uploadVideoFile stores the file and records a FILE video", async () => {
    vi.mocked(countRestaurantVideos).mockResolvedValue(0);

    await uploadVideoFile("res_1", videoFile);

    expect(putObject).toHaveBeenCalledWith(
      expect.stringMatching(/^restaurants\/res_1\/videos\/.*\.mp4$/),
      expect.any(Buffer),
      "video/mp4",
    );
    expect(createRestaurantVideo).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "FILE", storageKey: expect.any(String) }),
    );
  });

  it("removeVideo deletes the stored object for a FILE video", async () => {
    vi.mocked(findRestaurantVideoById).mockResolvedValue({
      id: "v1",
      restaurantId: "res_1",
      storageKey: "restaurants/res_1/videos/x.mp4",
    } as unknown as Awaited<ReturnType<typeof findRestaurantVideoById>>);

    await removeVideo("res_1", "v1");

    expect(deleteObject).toHaveBeenCalledWith("restaurants/res_1/videos/x.mp4");
    expect(deleteRestaurantVideo).toHaveBeenCalledWith("v1");
  });

  it("removeVideo rejects a video from another restaurant", async () => {
    vi.mocked(findRestaurantVideoById).mockResolvedValue({
      id: "v1",
      restaurantId: "other",
      storageKey: null,
    } as unknown as Awaited<ReturnType<typeof findRestaurantVideoById>>);

    await expect(removeVideo("res_1", "v1")).rejects.toThrow(VIDEO_FORBIDDEN);
    expect(deleteRestaurantVideo).not.toHaveBeenCalled();
  });
});
