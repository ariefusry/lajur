import { NewApplicationSection } from "@/components/application/new-application-section";

export const metadata = { title: "Lamaran baru · Lajur" };

export default async function NewApplicationPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const { stage } = await searchParams;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Lamaran baru</h1>
      <NewApplicationSection stage={stage} />
    </div>
  );
}
