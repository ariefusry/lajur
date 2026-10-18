"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/** Light/dark switch. Icons swap with CSS (`dark:`), so server and client markup match. */
export function ThemeToggle({ withLabel }: { withLabel?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const toggle = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");
  const icons = (
    <>
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </>
  );
  return withLabel ? (
    <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={toggle}>
      {icons}
      <span className="dark:hidden">Mode gelap</span>
      <span className="hidden dark:inline">Mode terang</span>
    </Button>
  ) : (
    <Button type="button" variant="ghost" size="icon-sm" aria-label="Ganti tema terang/gelap" onClick={toggle}>
      {icons}
    </Button>
  );
}
