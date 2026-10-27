import { JobSearch } from "@/components/jobs/job-search";
import { LamaranSubNav } from "@/components/nav-links";
import type { CvProfile } from "@/lib/ai/cv-profile";
import { aiEnabled } from "@/lib/ai/provider";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isReadOnly } from "@/lib/demo";

export const metadata = { title: "Cari lowongan · Lajur" };

export default async function JobsPage() {
  const user = await requireUser();
  const [resumes, profile] = await Promise.all([
    db.resume.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, versionName: true, extractedText: true, profile: true },
    }),
    db.user.findUnique({ where: { id: user.id }, select: { domicile: true, aiConsentAt: true } }),
  ]);

  return (
    <div className="max-w-7xl space-y-6">
      <LamaranSubNav />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Cari lowongan</h1>
        <p className="text-muted-foreground text-sm">
          Lajur menyusun kata kunci dari CV kamu, lalu membuka pencarian di Jobstreet, Glints, LinkedIn, dan Kalibrr.
          Lowongannya tampil di portal masing-masing.
        </p>
      </div>
      <JobSearch
        resumes={resumes.map((r) => ({
          id: r.id,
          versionName: r.versionName,
          hasText: !!r.extractedText,
          profile: (r.profile as CvProfile | null) ?? null,
        }))}
        domicile={profile?.domicile ?? ""}
        aiAvailable={aiEnabled()}
        aiConsented={!!profile?.aiConsentAt}
        readOnly={isReadOnly(user)}
      />
    </div>
  );
}
