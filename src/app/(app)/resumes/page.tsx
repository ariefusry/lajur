import { DeleteResumeButton, ViewResumeButton } from "@/components/resumes/resume-actions";
import { ResumeUpload } from "@/components/resumes/resume-upload";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";

export const metadata = { title: "CV · Lamarin" };

export default async function ResumesPage() {
  const user = await requireUser();
  const resumes = await db.resume.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      versionName: true,
      createdAt: true,
      extractedText: true,
      _count: { select: { applications: true } },
    },
  });

  return (
    <div className="max-w-6xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Versi CV</h1>
        <p className="text-muted-foreground text-sm">
          Simpan setiap versi CV, lalu tautkan ke lamaran supaya ingat versi mana yang dikirim ke mana.
        </p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <ResumeUpload />

        {resumes.length === 0 ? (
          <p className="text-muted-foreground text-sm">Belum ada CV yang diunggah.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {resumes.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.versionName}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(r.createdAt)} · dipakai di {r._count.applications} lamaran
                    {r.extractedText === null && " · teks tidak terbaca"}
                  </p>
                </div>
                <ViewResumeButton id={r.id} />
                <DeleteResumeButton id={r.id} name={r.versionName} usedBy={r._count.applications} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
