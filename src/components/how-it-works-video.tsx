"use client";

import { useTheme } from "next-themes";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const ALT =
  "Cara kerja Lajur: tempel lowongan, AI mengisi form dengan kutipan bukti, cek syarat dan CV, lalu geser kartu di board";

/**
 * Silent product loop for the landing's "Cara kerja" section (≈1.7 MB each). Only the current theme's file is
 * fetched, and only once the section is near the viewport; it pauses off-screen. With reduced motion only the
 * poster shows. Posters swap by CSS (`dark:`), so they're right before hydration too.
 */
export function HowItWorksVideo() {
  const { resolvedTheme } = useTheme();
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = () => setReducedMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!box.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setNear(true);
        if (!video.current) return;
        if (entry.isIntersecting) video.current.play().catch(() => {});
        else video.current.pause();
      },
      { rootMargin: "200px" },
    );
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  const theme = resolvedTheme === "dark" ? "dark" : "light";
  return (
    <div ref={box} className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border">
      <Image
        src="/landing/how-it-works-light.jpg"
        alt={ALT}
        fill
        sizes="(min-width: 1024px) 560px, 100vw"
        className="object-cover dark:hidden"
      />
      <Image
        src="/landing/how-it-works-dark.jpg"
        alt={ALT}
        fill
        sizes="(min-width: 1024px) 560px, 100vw"
        className="hidden object-cover dark:block"
      />
      {near && !reducedMotion && resolvedTheme && (
        <video
          key={theme}
          ref={video}
          src={`/landing/how-it-works-${theme}.mp4`}
          poster={`/landing/how-it-works-${theme}.jpg`}
          autoPlay
          muted
          loop
          playsInline
          aria-label={ALT}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </div>
  );
}
