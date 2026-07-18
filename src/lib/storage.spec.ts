import { beforeEach, describe, expect, it, vi } from "vitest";

const { send, PutObjectCommand, DeleteObjectCommand, S3Client } = vi.hoisted(
  () => {
    const send = vi.fn();
    class S3Client {
      send = send;
    }
    return {
      send,
      S3Client,
      PutObjectCommand: vi.fn(),
      DeleteObjectCommand: vi.fn(),
    };
  },
);

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
}));

process.env.SUPABASE_S3_ENDPOINT =
  "https://proj.storage.supabase.co/storage/v1/s3";
process.env.SUPABASE_S3_REGION = "ap-southeast-1";
process.env.SUPABASE_S3_BUCKET_NAME = "elitale-restro";
process.env.SUPABASE_S3_ACCESS_KEY = "key-id";
process.env.SUPABASE_S3_SECRET_KEY = "secret";

import { deleteObject, publicUrl, putObject } from "./storage";

describe("storage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("putObject uploads to the configured bucket with a cache header", async () => {
    send.mockResolvedValue({});

    await putObject("menu-items/i1/a.webp", Buffer.from("x"), "image/webp");

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: "elitale-restro",
        Key: "menu-items/i1/a.webp",
        ContentType: "image/webp",
      }),
    );
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("publicUrl builds the Supabase public object URL", () => {
    expect(publicUrl("menu-items/i1/a.webp")).toBe(
      "https://proj.storage.supabase.co/storage/v1/object/public/elitale-restro/menu-items/i1/a.webp",
    );
  });

  it("deleteObject removes the key", async () => {
    send.mockResolvedValue({});

    await deleteObject("menu-items/i1/a.webp");

    expect(DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: "elitale-restro",
      Key: "menu-items/i1/a.webp",
    });
  });
});
