"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Where the board/list last was (path + filters); read by the detail page's back link. */
export const LAST_VIEW_KEY = "lajur:last-applications-view";

/** Rendered on the board and the list: remembers that view, filters included, for the back link below. */
export function RememberApplicationsView() {
  useEffect(() => {
    try {
      sessionStorage.setItem(LAST_VIEW_KEY, location.pathname + location.search);
    } catch {}
  });
  return null;
}

/** "Semua lamaran": back to the board or the list, whichever the user came from (the board if unknown). */
export function BackToApplications() {
  const [href, setHref] = useState("/board");
  useEffect(() => {
    try {
      const last = sessionStorage.getItem(LAST_VIEW_KEY);
      if (last?.startsWith("/board") || last?.startsWith("/applications")) setHref(last);
    } catch {}
  }, []);
  return (
    <Link href={href} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
      <ArrowLeft className="size-4" aria-hidden /> Semua lamaran
    </Link>
  );
}
