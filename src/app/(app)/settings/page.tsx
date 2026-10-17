import { ArrowDown, ArrowUp } from "lucide-react";
import { addStage, moveStage, renameStage } from "@/actions/settings";
import { selectClass } from "@/lib/utils";
import { ProfileForm } from "@/components/settings/profile-form";
import { TemplatePicker } from "@/components/settings/template-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StageKind } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toDateInput } from "@/lib/dates";

export const metadata = { title: "Pengaturan · Lamarin" };

const KIND_LABELS: Record<StageKind, string> = {
  WISHLIST: "Wishlist",
  IN_PROGRESS: "Proses seleksi",
  OFFER: "Offering",
  REJECTED: "Ditolak",
  WITHDRAWN: "Mengundurkan diri",
};

export default async function SettingsPage() {
  const { id: userId } = await requireUser();
  const [profile, stages, applicationCount] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { gpa: true, birthDate: true, major: true, degree: true, domicile: true },
    }),
    db.stage.findMany({ where: { userId }, orderBy: { order: "asc" } }),
    db.application.count({ where: { userId } }),
  ]);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Profil</h1>
          <p className="text-sm text-muted-foreground">Dipakai untuk mengecek syarat lowongan (IPK, usia, jurusan).</p>
        </div>
        <ProfileForm
          defaults={{
            gpa: profile.gpa?.toFixed(2) ?? "",
            birthDate: toDateInput(profile.birthDate),
            major: profile.major ?? "",
            degree: profile.degree ?? "",
            domicile: profile.domicile ?? "",
          }}
        />
      </section>

      <section className="max-w-2xl space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Tahap seleksi</h2>
          <p className="text-sm text-muted-foreground">Kolom di board mengikuti urutan ini.</p>
        </div>

        <TemplatePicker disabled={applicationCount > 0} />

        <ol className="space-y-2">
          {stages.map((stage, i) => (
            <li key={stage.id} className="flex items-center gap-2">
              <form action={renameStage.bind(null, stage.id)} className="flex flex-1 gap-2">
                <Input name="name" defaultValue={stage.name} aria-label={`Nama tahap ${i + 1}`} required maxLength={50} />
                <Button type="submit" variant="outline" size="sm">
                  Simpan
                </Button>
              </form>
              <span className="hidden w-32 text-xs text-muted-foreground sm:block">{KIND_LABELS[stage.kind]}</span>
              <form action={moveStage.bind(null, stage.id, -1)}>
                <Button type="submit" variant="ghost" size="icon-sm" disabled={i === 0} aria-label={`Naikkan ${stage.name}`}>
                  <ArrowUp />
                </Button>
              </form>
              <form action={moveStage.bind(null, stage.id, 1)}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === stages.length - 1}
                  aria-label={`Turunkan ${stage.name}`}
                >
                  <ArrowDown />
                </Button>
              </form>
            </li>
          ))}
        </ol>

        <form action={addStage} className="flex flex-wrap gap-2 border-t pt-4">
          <Input name="name" placeholder="Nama tahap baru, contoh: Tes Kesehatan" required maxLength={50} className="min-w-48 flex-1" aria-label="Nama tahap baru" />
          <select name="kind" defaultValue="IN_PROGRESS" className={`${selectClass} w-auto`} aria-label="Jenis tahap">
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button type="submit">Tambah tahap</Button>
        </form>
      </section>
    </div>
  );
}
