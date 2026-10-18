import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="max-w-sm space-y-4 text-center">
        <p className="text-primary text-5xl font-semibold tracking-tight">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">Halaman tidak ditemukan</h1>
        <p className="text-muted-foreground text-sm">
          Alamatnya mungkin salah, atau lamaran yang kamu cari sudah dihapus.
        </p>
        <Button asChild size="lg">
          <Link href="/board">Kembali ke board</Link>
        </Button>
      </div>
    </main>
  );
}
