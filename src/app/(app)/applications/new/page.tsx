import { NewApplicationSection } from "@/components/application/new-application-section";

export const metadata = { title: "Lamaran baru · Lajur" };

export default function NewApplicationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Lamaran baru</h1>
      <NewApplicationSection />
    </div>
  );
}
