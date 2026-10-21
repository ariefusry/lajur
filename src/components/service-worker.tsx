"use client";

import { useEffect } from "react";

// Chrome/Edge/Samsung Internet only; not in the DOM typings.
export type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
declare global {
  interface Window {
    lajurInstallPrompt?: InstallPrompt | null;
  }
}

/**
 * Registers public/sw.js (offline page for the installed app; production only, so dev never serves stale files).
 * Also keeps the browser's install prompt: it fires once per page load, usually before Settings is open.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const keep = (e: Event) => {
      e.preventDefault();
      window.lajurInstallPrompt = e as InstallPrompt;
      dispatchEvent(new Event("lajur:installable"));
    };
    addEventListener("beforeinstallprompt", keep);
    return () => removeEventListener("beforeinstallprompt", keep);
  }, []);
  return null;
}
