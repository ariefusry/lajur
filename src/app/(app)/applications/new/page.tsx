import Link from "next/link";
import { NewApplication } from "@/components/application/new-application";
import { hasAiConsent } from "@/lib/ai/consent";
import { aiEnabled } from "@/lib/ai/provider";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isReadOnly } from "@/lib/demo";
import { getEligibilityProfile } from "@/lib/eligibility/profile";

export const metadata = { title: "Lamaran baru · Lajur" };

export default async function NewApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const user = await requireUser();
  const [stages, resumes, profile, aiConsent] = await Promise.all([
    db.stage.findMany({ where: { userId: user.id }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
    db.resume.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true, versionName: true } }),
    getEligibilityProfile(user.id),
    hasAiConsent(user.id),
  ]);
  const { stage } = await searchParams;

  if (stages.length === 0) {
    return (
      <p className="text-sm">
        Belum ada tahap seleksi. Pilih template dulu di <Link href="/settings" className="underline">Pengaturan</Link>.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Lamaran baru</h1>
      <NewApplication
        aiEnabled={aiEnabled() && !isReadOnly(user)}
        aiConsent={aiConsent}
        stages={stages}
        resumes={resumes}
        profile={{ ...profile, birthDate: profile.birthDate?.toISOString() ?? null }}
        defaults={{
          company: "",
          position: "",
          source: "",
          currentStageId: stages.some((s) => s.id === stage) ? stage! : stages[0].id,
          resumeId: resumes[0]?.id ?? "",
          url: "",
          location: "",
          deadline: "",
          appliedAt: "",
          expectedSalary: "",
          notes: "",
        }}
      />
    </div>
  );
}
