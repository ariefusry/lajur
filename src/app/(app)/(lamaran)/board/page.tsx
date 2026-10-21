import { Board } from "@/components/board/board";
import { RememberApplicationsView } from "@/components/application/back-to-applications";
import { BoardTip } from "@/components/onboarding/board-tip";
import { requireUser } from "@/lib/auth";
import { appFactsFor } from "@/lib/dashboard";
import { db } from "@/lib/db";
import { checkRequirement, overallStatus } from "@/lib/eligibility/check";
import { getEligibilityProfile } from "@/lib/eligibility/profile";

export const metadata = { title: "Board · Lajur" };

export default async function BoardPage() {
  const user = await requireUser();
  const today = new Date();
  const [stages, applications, profile, { onboardedAt }] = await Promise.all([
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
        events: {
          where: { startsAt: { gte: today } },
          orderBy: { startsAt: "asc" },
          take: 1,
          select: { type: true, startsAt: true, opensAt: true },
        },
      },
    }),
    getEligibilityProfile(user.id),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { onboardedAt: true } }),
  ]);
  // Tip for the first two weeks after the wizard (users from before it have onboardedAt = sign-up date).
  const freshUser = !!onboardedAt && today.getTime() - onboardedAt.getTime() < 14 * 86_400_000;
  const factsOf = appFactsFor(stages, today);
  const cards = applications.map(({ requirements, history, appliedAt, events, ...app }) => ({
    ...app,
    nextEvent: events[0] ?? null,
    ghosted: factsOf({ currentStageId: app.currentStageId, appliedAt, history }).ghosted,
    eligibility: overallStatus(requirements.map((r) => checkRequirement(r, profile, today).status)),
  }));
  // Soonest scheduled test/interview first within each column; the rest keep "recently updated" order.
  const soonest = (c: (typeof cards)[number]) => c.nextEvent?.startsAt.getTime() ?? Infinity;
  cards.sort((a, b) => soonest(a) - soonest(b) || 0); // Infinity - Infinity is NaN

  return (
    <div className="space-y-4 motion-safe:animate-[fade-in_300ms_ease-out]">
      <RememberApplicationsView />
      {freshUser && applications.length > 0 && <BoardTip />}
      {applications.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Belum ada lamaran. Klik “Tambah lamaran”, lalu geser kartunya antar kolom saat tahapnya berubah.
        </p>
      )}
      <Board stages={stages} initialApplications={cards} />
    </div>
  );
}
