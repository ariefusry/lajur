import Link from "next/link";
import { Board } from "@/components/board/board";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRequirement, overallStatus } from "@/lib/eligibility/check";
import { getEligibilityProfile } from "@/lib/eligibility/profile";

export const metadata = { title: "Board · Lamarin" };

export default async function BoardPage() {
  const user = await requireUser();
  const [stages, applications, profile] = await Promise.all([
    db.stage.findMany({
      where: { userId: user.id },
      orderBy: { order: "asc" },
      select: { id: true, name: true, kind: true },
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
        requirements: { select: { type: true, value: true, ageReferenceDate: true } },
      },
    }),
    getEligibilityProfile(user.id),
  ]);
  const today = new Date();
  const cards = applications.map(({ requirements, ...app }) => ({
    ...app,
    eligibility: overallStatus(requirements.map((r) => checkRequirement(r, profile, today).status)),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Board lamaran</h1>
        <Button asChild>
          <Link href="/applications/new">Tambah lamaran</Link>
        </Button>
      </div>
      {applications.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Belum ada lamaran. Klik “Tambah lamaran”, lalu geser kartunya antar kolom saat tahapnya berubah.
        </p>
      )}
      <Board stages={stages} initialApplications={cards} />
    </div>
  );
}
