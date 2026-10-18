"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Terjadi kesalahan</h1>
        <p className="text-muted-foreground text-sm">
          Datamu aman. Coba muat ulang; kalau masih gagal, kembali ke board dan ulangi beberapa saat lagi.
        </p>
        <div className="flex justify-center gap-2">
          <Button size="lg" onClick={reset}>
            Coba lagi
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/board">Ke board</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
