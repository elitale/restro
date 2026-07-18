import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const env = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

let cached: S3Client | undefined;

/** Lazily-built S3 client pointed at Supabase Storage's S3-compatible API. */
const s3 = (): S3Client => {
  cached ??= new S3Client({
    endpoint: env("SUPABASE_S3_ENDPOINT"),
    region: env("SUPABASE_S3_REGION"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: env("SUPABASE_S3_ACCESS_KEY"),
      secretAccessKey: env("SUPABASE_S3_SECRET_KEY"),
    },
  });
  return cached;
};

export const putObject = async (
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> => {
  await s3().send(
    new PutObjectCommand({
      Bucket: env("SUPABASE_S3_BUCKET_NAME"),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
};

export const deleteObject = async (key: string): Promise<void> => {
  await s3().send(
    new DeleteObjectCommand({
      Bucket: env("SUPABASE_S3_BUCKET_NAME"),
      Key: key,
    }),
  );
};

/** Public object URL (the bucket must be public-read). */
export const publicUrl = (key: string): string => {
  const base = env("SUPABASE_S3_ENDPOINT").replace(/\/s3\/?$/, "");
  return `${base}/object/public/${env("SUPABASE_S3_BUCKET_NAME")}/${key}`;
};
