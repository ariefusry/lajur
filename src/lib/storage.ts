import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Endpoint, region and credentials come from the AWS_* env vars written by `neon deploy`
// (AWS_ENDPOINT_URL_S3, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).
export const storage = new S3Client({
  forcePathStyle: true, // WAJIB: Neon hanya mendukung path-style addressing
});

// Declared in neon.ts.
const BUCKET = "resumes";

export async function putPdf(key: string, body: Uint8Array) {
  await storage.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: "application/pdf",
    }),
  );
}

export function presignGet(key: string, expiresIn = 60) {
  return getSignedUrl(
    storage,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ResponseContentDisposition: "inline",
    }),
    { expiresIn },
  );
}

export async function deleteObject(key: string) {
  await storage.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
