// Demo account + 15 dummy applications (mixed fields) + 2 CV versions, dated relative to today.
// Re-running resets ONLY the demo account (the same reset runs daily in production: /api/cron/demo-reset).
// Run: pnpm db:seed
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { DEMO_EMAIL } from "../src/lib/demo.ts";
import { resetDemoAccount } from "../src/lib/demo-reset.ts";

const BUCKET = "resumes"; // as in neon.ts / src/lib/storage.ts
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const s3 = new S3Client({ forcePathStyle: true }); // AWS_* env vars from `neon deploy`

const result = await resetDemoAccount({
  db,
  putPdf: (Key, Body) => s3.send(new PutObjectCommand({ Bucket: BUCKET, Key, Body, ContentType: "application/pdf" })),
  deleteObject: (Key) => s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key })),
});
console.log(`Seeded ${DEMO_EMAIL}: ${result.stages} stages, ${result.resumes} CVs, ${result.applications} applications.`);
await db.$disconnect();
