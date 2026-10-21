import Link from "next/link";
import { NewApplication } from "@/components/application/new-application";
import { hasAiConsent } from "@/lib/ai/consent";
import { aiEnabled, visionEnabled } from "@/lib/ai/provider";
import { getQuota } from "@/lib/ai/usage";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isReadOnly } from "@/lib/demo";
import { getEligibilityProfile } from "@/lib/eligibility/profile";

/** The new-application form with everything it needs; shared by /applications/new and the /mulai wizard. */
export async function NewApplicationSection() {
  const user = await requireUser();
  const [stages, resumes, profile, aiConsent, quota] = await Promise.all([
    db.stage.findMany({
      where: { userId: user.id },
      orderBy: { order: "asc" },
      select: { id: true, name: true, kind: true },
    }),
    db.resume.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, versionName: true },
    }),
    getEligibilityProfile(user.id),
    hasAiConsent(user.id),
    getQuota(user.id),
  ]);

  if (stages.length === 0) {
    return (
      <p className="text-sm">
        Belum ada tahap seleksi. Pilih template dulu di{" "}
        <Link href="/settings" className="underline">
          Pengaturan
        </Link>
        .
      </p>
    );
  }

  return (
    <NewApplication
      aiEnabled={aiEnabled() && !isReadOnly(user)}
      visionEnabled={visionEnabled()}
      aiConsent={aiConsent}
      quota={quota}
      stages={stages}
      resumes={resumes}
      profile={{ ...profile, birthDate: profile.birthDate?.toISOString() ?? null }}
      defaults={{
        company: "",
        position: "",
        source: "",
        // New applications start in Wishlist.
        currentStageId: (stages.find((s) => s.kind === "WISHLIST") ?? stages[0]).id,
        resumeId: resumes[0]?.id ?? "",
        url: "",
        location: "",
        deadline: "",
        appliedAt: "",
        expectedSalary: "",
        notes: "",
      }}
    />
  );
}
