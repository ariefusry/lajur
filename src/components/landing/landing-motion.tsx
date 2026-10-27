"use client";

import { useEffect } from "react";
import { drawHeroLines } from "@/components/landing/hero-lines";

const PORTAL_STEP_MS = 1700;

/**
 * GSAP + ScrollTrigger choreography for the landing page (DESIGN.md, "Gerak"). It renders nothing: it finds
 * what to move by `data-lm` attributes in app/page.tsx. Everything is visible without it (SSR, no JS, reduced
 * motion); the effects only start once GSAP has loaded, and reduced motion skips them all.
 * The one loop, the portal carousel, runs only while its panel is on screen.
 */
export function LandingMotion() {
  useEffect(() => {
    let cancelled = false;
    let revert = () => {};
    let refresh = () => {};

    // The route lines are information, not motion: they are drawn even when the effects below are skipped.
    const box = document.querySelector<HTMLElement>('[data-lm="hero-box"]');
    const redraw = () => box && drawHeroLines(box);
    redraw();
    const observer = new ResizeObserver(redraw);
    if (box) observer.observe(box);
    void document.fonts?.ready.then(redraw);

    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const all = (name: string) => gsap.utils.toArray<HTMLElement>(`[data-lm="${name}"]`);

      const mm = gsap.matchMedia();
      mm.add({ ok: "(prefers-reduced-motion: no-preference)", wide: "(min-width: 768px)" }, (context) => {
        const { ok, wide } = (context.conditions ?? {}) as { ok?: boolean; wide?: boolean };
        if (!ok) return;
        let timer: ReturnType<typeof setInterval> | undefined;
        let stopSync = () => {};

        // Hero: stages and the node drift up at different speeds as the page scrolls away from them.
        const hero = document.querySelector<HTMLElement>('[data-lm="hero"]');
        if (hero) {
          const drift = { trigger: hero, start: "top top", end: "bottom top", scrub: 0.6 };
          all("hero-tile").forEach((el) =>
            gsap.to(el, { y: -Number(el.dataset.speed ?? 40), ease: "none", scrollTrigger: drift }),
          );
          all("hero-fade").forEach((el) => gsap.to(el, { opacity: 0, ease: "none", scrollTrigger: drift }));

          // The lines follow the tiles: while the hero is on screen, every frame draws them again.
          ScrollTrigger.create({
            trigger: hero,
            start: "top bottom",
            end: "bottom top",
            onToggle: (self) => (self.isActive ? gsap.ticker.add(redraw) : gsap.ticker.remove(redraw)),
          });
          stopSync = () => gsap.ticker.remove(redraw);
        }

        // Headings: the words come in one after another, out of a blur.
        all("heading").forEach((heading) => {
          gsap.from(heading.querySelectorAll('[data-lm="word"]'), {
            opacity: 0,
            y: 14,
            filter: "blur(12px)",
            duration: 0.7,
            ease: "power2.out",
            stagger: 0.06,
            scrollTrigger: { trigger: heading, start: "top 85%" },
          });
        });

        // Cards and steps rise as they enter.
        all("rise").forEach((el) => {
          gsap.from(el, {
            y: 60,
            opacity: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 90%" },
          });
        });

        // Example bars are drawn from the left.
        all("bar").forEach((el) => {
          gsap.from(el, {
            scaleX: 0,
            transformOrigin: "left center",
            duration: 1,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 92%" },
          });
        });

        // The app pieces around the second heading: rise in turn, then scatter at different speeds while scrolling.
        const floats = all("float");
        const floatSection = floats[0]?.closest("section");
        if (floats.length && floatSection) {
          gsap.from(floats, {
            y: 90,
            opacity: 0,
            duration: 0.9,
            ease: "power3.out",
            stagger: 0.12,
            scrollTrigger: { trigger: floatSection, start: "top 70%" },
          });
          if (wide) {
            floats.forEach((el, i) =>
              gsap.to(el, {
                yPercent: i % 2 ? -16 : 12,
                ease: "none",
                scrollTrigger: { trigger: floatSection, start: "top bottom", end: "bottom top", scrub: true },
              }),
            );
          }
        }

        // Portals: the panel grows to full width, the tiles rise, and the raised tile moves along on a timer.
        const panel = document.querySelector<HTMLElement>('[data-lm="portal-panel"]');
        const tiles = all("portal-tile");
        if (panel && tiles.length) {
          gsap.fromTo(
            panel,
            { scale: 0.92 },
            {
              scale: 1,
              ease: "none",
              scrollTrigger: { trigger: panel, start: "top bottom", end: "top 35%", scrub: true },
            },
          );
          gsap.from(tiles, {
            y: 80,
            opacity: 0,
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.1,
            scrollTrigger: { trigger: panel, start: "top 60%" },
          });

          let active = 1;
          const show = () => {
            tiles.forEach((tile, k) => {
              const on = k === active;
              gsap.to(tile.querySelector('[data-lm="portal-box"]'), {
                scale: on ? 1.15 : 1,
                y: on ? -18 : 0,
                duration: 0.6,
                ease: "power2.out",
              });
              gsap.to(tile.querySelector('[data-lm="portal-name"]'), { opacity: on ? 1 : 0.55, duration: 0.6 });
            });
          };
          ScrollTrigger.create({
            trigger: panel,
            start: "top 70%",
            end: "bottom 20%",
            onToggle: (self) => {
              clearInterval(timer);
              if (!self.isActive) return;
              show();
              timer = setInterval(() => {
                active = (active + 1) % tiles.length;
                show();
              }, PORTAL_STEP_MS);
            },
          });
        }

        // The wordmark rises out of a blur when the footer comes into view.
        const wordmark = document.querySelector<HTMLElement>('[data-lm="wordmark"]');
        if (wordmark) {
          gsap.from(wordmark, {
            y: 140,
            opacity: 0,
            filter: "blur(18px)",
            duration: 1.2,
            ease: "power3.out",
            scrollTrigger: { trigger: wordmark, start: "top 105%" },
          });
        }

        // The interval must not outlive the media query.
        return () => {
          clearInterval(timer);
          stopSync();
        };
      });

      refresh = () => ScrollTrigger.refresh();
      window.addEventListener("load", refresh);
      revert = () => mm.revert();
    })();

    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("load", refresh);
      revert();
    };
  }, []);

  return null;
}
