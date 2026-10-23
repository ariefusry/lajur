"use client";

import { useLayoutEffect, type RefObject } from "react";

/**
 * Trello-style: the board is exactly one screen tall, so columns run to the bottom edge, the horizontal
 * scrollbar stays in view, and a long column scrolls inside itself instead of stretching the page.
 * Shared by the board and its loading skeleton, so the two are the same size.
 */
export function useBoardHeight(scroller: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = scroller.current;
    const main = el?.closest("main");
    if (!el || !main) return;
    const fit = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const pad = parseFloat(getComputedStyle(main).paddingBottom);
      // Phones: down to just above the tab bar. main's tall bottom padding (room for the floating + button on
      // pages that scroll) isn't needed here, so the margin takes it back.
      const bar = document.querySelector("[data-tab-bar]")?.getBoundingClientRect();
      const below = bar?.height ? window.innerHeight - bar.top + 12 : pad;
      el.style.marginBottom = `${below - pad}px`;
      // 320px floor: on a short landscape phone the page scrolls instead of the board shrinking to a sliver.
      el.style.height = `${Math.max(320, window.innerHeight - top - below)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    // The page enter animation (app/(app)/template.tsx) shifts the board while it runs; measure again after.
    window.addEventListener("animationend", fit);
    const ro = new ResizeObserver(fit); // the header above can wrap (demo banner, narrow screens)
    ro.observe(main);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("animationend", fit);
      ro.disconnect();
    };
  }, [scroller]);
}

// Shared with the loading skeleton, so it has the same columns and cards as the loaded board.
export const BOARD_SCROLLER =
  "-mx-4 -mt-1 flex snap-x gap-3 overflow-x-auto px-4 pt-1 pb-4 md:-mx-1 md:snap-none md:px-1";
export const BOARD_COLUMN =
  "bg-foreground/[0.04] flex w-[min(17rem,82vw)] shrink-0 snap-start flex-col gap-2.5 rounded-2xl p-2.5 transition-colors";
export const BOARD_CARD = "glass rounded-xl border p-3.5 text-sm";
