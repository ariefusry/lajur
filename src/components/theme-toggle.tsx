"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const THEMES = [
  { value: "system", label: "Sesuai perangkat", Icon: Monitor },
  { value: "light", label: "Terang", Icon: Sun },
  { value: "dark", label: "Gelap", Icon: Moon },
] as const;

/**
 * Theme switch cycling device setting → light → dark. The chosen theme is only known in the browser, so the
 * server render (and the first client render) shows a neutral sun/moon swapped by CSS instead.
 */
export function ThemeToggle({ withLabel }: { withLabel?: boolean }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const i = Math.max(
    0,
    THEMES.findIndex((t) => t.value === theme),
  );
  const current = THEMES[i];
  const next = THEMES[(i + 1) % THEMES.length];
  const icon = mounted ? (
    <current.Icon />
  ) : (
    <>
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </>
  );
  const title = mounted ? `Tema: ${current.label}. Ganti ke ${next.label.toLowerCase()}` : "Ganti tema";
  const onClick = () => setTheme(next.value);
  return withLabel ? (
    <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={onClick} title={title}>
      {icon}
      <span>{mounted ? `Tema: ${current.label}` : "Tema"}</span>
    </Button>
  ) : (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={title} title={title} onClick={onClick}>
      {icon}
    </Button>
  );
}
