import type { StageKind } from "@/generated/prisma/enums";

export type TemplateKey = "BUMN" | "STARTUP" | "UMUM" | "RETAIL" | "CPNS";

export const STAGE_TEMPLATES: Record<
  TemplateKey,
  { label: string; stages: { name: string; kind: StageKind }[] }
> = {
  BUMN: {
    label: "BUMN/Bank",
    stages: [
      { name: "Wishlist", kind: "WISHLIST" },
      { name: "Administrasi", kind: "IN_PROGRESS" },
      { name: "Tes Online/TPA", kind: "IN_PROGRESS" },
      { name: "Psikotes", kind: "IN_PROGRESS" },
      { name: "LGD", kind: "IN_PROGRESS" },
      { name: "Interview HR", kind: "IN_PROGRESS" },
      { name: "Interview User", kind: "IN_PROGRESS" },
      { name: "MCU", kind: "IN_PROGRESS" },
      { name: "Offering", kind: "OFFER" },
      { name: "Ditolak", kind: "REJECTED" },
    ],
  },
  UMUM: {
    label: "Umum (semua bidang)",
    stages: [
      { name: "Wishlist", kind: "WISHLIST" },
      { name: "Melamar", kind: "IN_PROGRESS" },
      { name: "Tes", kind: "IN_PROGRESS" },
      { name: "Interview", kind: "IN_PROGRESS" },
      { name: "Offering", kind: "OFFER" },
      { name: "Ditolak", kind: "REJECTED" },
    ],
  },
  RETAIL: {
    label: "Retail/Pabrik",
    stages: [
      { name: "Wishlist", kind: "WISHLIST" },
      { name: "Melamar", kind: "IN_PROGRESS" },
      { name: "Seleksi Berkas", kind: "IN_PROGRESS" },
      { name: "Tes Tertulis/Praktik", kind: "IN_PROGRESS" },
      { name: "Interview", kind: "IN_PROGRESS" },
      { name: "Medical Check-up", kind: "IN_PROGRESS" },
      { name: "Offering", kind: "OFFER" },
      { name: "Ditolak", kind: "REJECTED" },
    ],
  },
  CPNS: {
    label: "CPNS/Instansi Pemerintah",
    stages: [
      { name: "Wishlist", kind: "WISHLIST" },
      { name: "Seleksi Administrasi", kind: "IN_PROGRESS" },
      { name: "SKD", kind: "IN_PROGRESS" },
      { name: "SKB", kind: "IN_PROGRESS" },
      { name: "Pemberkasan", kind: "IN_PROGRESS" },
      { name: "Lolos (NIP)", kind: "OFFER" },
      { name: "Tidak Lolos", kind: "REJECTED" },
    ],
  },
  STARTUP: {
    label: "Startup",
    stages: [
      { name: "Wishlist", kind: "WISHLIST" },
      { name: "Melamar", kind: "IN_PROGRESS" },
      { name: "Technical Test", kind: "IN_PROGRESS" },
      { name: "Interview HR", kind: "IN_PROGRESS" },
      { name: "Interview User", kind: "IN_PROGRESS" },
      { name: "Offering", kind: "OFFER" },
      { name: "Ditolak", kind: "REJECTED" },
    ],
  },
};

export function templateStageRows(key: TemplateKey, userId: string) {
  return STAGE_TEMPLATES[key].stages.map((s, order) => ({ ...s, order, userId }));
}
