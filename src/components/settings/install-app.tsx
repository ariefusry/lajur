"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import type { InstallPrompt } from "@/components/service-worker";
import { Button } from "@/components/ui/button";

/** Install Lajur to the home screen: the browser's own prompt where there is one, written steps otherwise. */
export function InstallApp() {
  const [state, setState] = useState<"unknown" | "installed" | "ios" | "other">("unknown");
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const standalone =
      matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    // iPadOS reports itself as a Mac; touch points tell them apart.
    const ios =
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    setState(standalone ? "installed" : ios ? "ios" : "other");

    // The prompt is caught by <ServiceWorker /> in the root layout, possibly before this page opened.
    const onPrompt = () => setPrompt(window.lajurInstallPrompt ?? null);
    const onInstalled = () => {
      window.lajurInstallPrompt = null;
      setPrompt(null);
      setState("installed");
    };
    onPrompt();
    addEventListener("lajur:installable", onPrompt);
    addEventListener("appinstalled", onInstalled);
    return () => {
      removeEventListener("lajur:installable", onPrompt);
      removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    window.lajurInstallPrompt = null; // a prompt can only be shown once
    setPrompt(null);
  }

  if (state === "unknown") return null;
  if (state === "installed") return <p className="text-sm">Lajur sudah terpasang di perangkat ini.</p>;
  if (state === "ios") {
    return (
      <p className="text-sm">
        Buka Lajur di <strong>Safari</strong>, ketuk tombol <strong>Bagikan</strong> (kotak dengan panah ke atas), lalu
        pilih <strong>Tambah ke Layar Utama</strong>.
      </p>
    );
  }
  return prompt ? (
    <Button type="button" onClick={install}>
      <Download />
      Pasang Lajur
    </Button>
  ) : (
    <p className="text-sm">
      Buka menu browser (⋮), lalu pilih <strong>Instal aplikasi</strong> atau <strong>Tambahkan ke layar utama</strong>.
    </p>
  );
}
