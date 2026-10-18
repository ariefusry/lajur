import { addStage } from "@/actions/settings";
import { StageEditor } from "@/components/settings/stage-editor";
import { ProfileForm } from "@/components/settings/profile-form";
import { TemplatePicker } from "@/components/settings/template-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toDateInput } from "@/lib/dates";
import { STAGE_KIND_LABELS } from "@/lib/validation";
import { Select, optionsFrom } from "@/components/ui/select";

export const metadata = { title: "Pengaturan · Lamarin" };

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
    <div className="grid max-w-6xl items-start gap-10 xl:grid-cols-2">
      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profil</h1>
          <p className="text-muted-foreground text-sm">Dipakai untuk mengecek syarat lowongan (IPK, usia, jurusan).</p>
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

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Tahap seleksi</h2>
          <p className="text-muted-foreground text-sm">Kolom di board mengikuti urutan ini.</p>
        </div>

        <TemplatePicker disabled={applicationCount > 0} />

        <StageEditor stages={stages.map((s) => ({ id: s.id, name: s.name, kind: s.kind }))} />

        <form action={addStage} className="flex flex-wrap gap-2 border-t pt-4">
          <Input
            name="name"
            placeholder="Nama tahap baru, contoh: Tes Kesehatan"
            required
            maxLength={50}
            className="min-w-48 flex-1"
            aria-label="Nama tahap baru"
          />
          <Select
            name="kind"
            defaultValue="IN_PROGRESS"
            className="w-44"
            aria-label="Jenis tahap"
            options={optionsFrom(STAGE_KIND_LABELS)}
          />
          <Button type="submit">Tambah tahap</Button>
        </form>
      </section>
    </div>
  );
}
