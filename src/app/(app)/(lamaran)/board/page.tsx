import { Board } from "@/components/board/board";
import { requireUser } from "@/lib/auth";
import { appFactsFor } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { checkRequirement, overallStatus } from "@/lib/eligibility/check";
import { getEligibilityProfile } from "@/lib/eligibility/profile";

export const metadata = { title: "Board · Lajur" };

export default async function BoardPage() {
  const user = await requireUser();
  const [stages, applications, profile] = await Promise.all([
    db.stage.findMany({
      where: { userId: user.id },
      orderBy: { order: "asc" },
      select: { id: true, name: true, order: true, kind: true },
    }),
    db.application.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        company: true,
        position: true,
        source: true,
        deadline: true,
        currentStageId: true,
        appliedAt: true,
        history: { select: { stageId: true, enteredAt: true } },
        requirements: { select: { type: true, value: true, ageReferenceDate: true } },
      },
    }),
    getEligibilityProfile(user.id),
  ]);
  const today = new Date();
  const factsOf = appFactsFor(stages, today);
  const cards = applications.map(({ requirements, history, appliedAt, ...app }) => ({
    ...app,
    ghosted: factsOf({ currentStageId: app.currentStageId, appliedAt, history }).ghosted,
    eligibility: overallStatus(requirements.map((r) => checkRequirement(r, profile, today).status)),
  }));

  return (
    <div className="space-y-4 motion-safe:animate-[fade-in_300ms_ease-out]">
      {applications.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Belum ada lamaran. Klik “Tambah lamaran”, lalu geser kartunya antar kolom saat tahapnya berubah.
        </p>
      )}
      <Board stages={stages} initialApplications={cards} />
    </div>
  );
}
