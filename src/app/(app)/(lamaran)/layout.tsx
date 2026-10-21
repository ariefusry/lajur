import Link from "next/link";
import { LamaranSubNav } from "@/components/nav-links";
import { Button } from "@/components/ui/button";
import { ViewSwitch } from "@/components/view-switch";

/** Board and list share this header, so switching views only swaps what's below it. */
export default function ApplicationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <LamaranSubNav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Lamaran</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ViewSwitch />
          <Button asChild>
            <Link href="/applications/new">Tambah lamaran</Link>
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}
