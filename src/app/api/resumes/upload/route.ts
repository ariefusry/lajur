import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_READ_ONLY_MESSAGE, isReadOnly } from "@/lib/demo";
import { validatePdf } from "@/lib/pdf";
import { extractPdfText } from "@/lib/pdf-text";
import { deleteObject, putPdf } from "@/lib/storage";
import { resumeNameSchema } from "@/lib/validation";

export const runtime = "nodejs";

const fail = (message: string, status = 400) => Response.json({ error: message }, { status });

// Upload goes through the server so the file is validated before it reaches the bucket.
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return fail("Silakan masuk dulu.", 401);
  if (isReadOnly({ email: session.user?.email ?? null })) return fail(DEMO_READ_ONLY_MESSAGE, 403);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const name = resumeNameSchema.safeParse(form?.get("versionName"));
  if (!(file instanceof File)) return fail("Pilih file PDF.");
  if (!name.success) return fail("Nama versi wajib diisi (maks. 100 karakter).");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const invalid = validatePdf(bytes, file.type);
  if (invalid) return fail(invalid);

  const id = randomUUID();
  const key = `cv/${userId}/${id}.pdf`;
  const extractedText = await extractPdfText(bytes);

  try {
    await putPdf(key, bytes);
  } catch (error) {
    console.error("resume upload: storage put failed", error);
    return fail("Gagal menyimpan file. Coba lagi.", 502);
  }

  try {
    await db.resume.create({ data: { id, userId, versionName: name.data, filePath: key, extractedText } });
  } catch (error) {
    console.error("resume upload: db insert failed", error);
    await deleteObject(key).catch((e) => console.error("resume upload: cleanup failed", e));
    return fail("Gagal menyimpan data CV. Coba lagi.", 500);
  }

  revalidatePath("/resumes");
  return Response.json({ id, hasText: extractedText !== null }, { status: 201 });
}
