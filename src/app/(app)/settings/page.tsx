import { addStage } from "@/actions/settings";
import { Card } from "@/components/dashboard/cards";
import { AccountData } from "@/components/settings/account-data";
import { AiConsent } from "@/components/ai-consent";
import { InstallApp } from "@/components/settings/install-app";
import { ProfileForm } from "@/components/settings/profile-form";
import { StageEditor } from "@/components/settings/stage-editor";
import { TemplatePicker } from "@/components/settings/template-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { requireUser } from "@/lib/auth";
import { toDateInput } from "@/lib/dates";
import { db } from "@/lib/db";
import { isDemoEmail, isReadOnly } from "@/lib/demo";
import { optionsFrom } from "@/lib/utils";
import { STAGE_KIND_LABELS } from "@/lib/validation";

export const metadata = { title: "Pengaturan · Lajur" };

export default async function SettingsPage() {
  const { id: userId, email } = await requireUser();
  const [profile, stages, applicationCount] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { gpa: true, birthDate: true, major: true, degree: true, domicile: true, aiConsentAt: true },
    }),
    db.stage.findMany({ where: { userId }, orderBy: { order: "asc" } }),
    db.application.count({ where: { userId } }),
  ]);

  return (
    <div className="max-w-7xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Pengaturan</h1>

      {/* Desktop: Profil + Data & akun stacked on the left, the (long) stage list on the right.
          Phone: one column in the order Profil, Tahap, Data & akun (the danger zone last). */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="contents lg:flex lg:flex-col lg:gap-4">
          <Card
            title="Profil"
            description="Dipakai untuk mengecek syarat lowongan (IPK, usia, jurusan)."
            className="order-1 lg:order-none"
          >
            <ProfileForm
              defaults={{
                gpa: profile.gpa?.toFixed(2) ?? "",
                birthDate: toDateInput(profile.birthDate),
                major: profile.major ?? "",
                degree: profile.degree ?? "",
                domicile: profile.domicile ?? "",
              }}
            />
          </Card>
          <Card
            title="Persetujuan AI"
            description="Fitur AI hanya aktif setelah kamu setuju."
            className="order-1 lg:order-none"
          >
            <AiConsent consentedAt={profile.aiConsentAt?.toISOString() ?? null} readOnly={isReadOnly({ email })} />
          </Card>
          <Card
            title="Pasang aplikasi"
            description="Buka Lajur dari layar utama HP atau laptop, tanpa bilah browser."
            className="order-3 lg:order-none"
          >
            <InstallApp />
          </Card>
          <Card
            title="Data & akun"
            description="Datamu milikmu: unduh salinannya, atau hapus semuanya."
            className="order-3 lg:order-none"
          >
            <AccountData isDemo={isDemoEmail(email)} applicationCount={applicationCount} />
          </Card>
        </div>

        <Card
          title="Tahap seleksi"
          description="Kolom di board mengikuti urutan ini."
          className="order-2 lg:order-none"
        >
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
              className="w-40"
              aria-label="Jenis tahap"
              options={optionsFrom(STAGE_KIND_LABELS)}
            />
            <Button type="submit" className="h-10 pointer-coarse:h-11">
              Tambah tahap
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
