// ScrollBackdrop — latar bergerak searah scroll (satu arah, compositor-only).
// Satu layer fixed: grid samar + garis kurva tipis yang translate mengikuti
// progres scroll halaman. Hanya `transform` via rAF (murah di GPU).
// Hormati prefers-reduced-motion: diam total bila user memintanya.
"use client";

import { useEffect, useRef } from "react";

export default function ScrollBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      // Gerak searah scroll: grid geser + kurva turun lebih jauh (parallax).
      el.style.setProperty("--scroll-p", p.toFixed(4));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        ref={ref}
        className="absolute inset-[-20%]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          transform: "translate3d(0, calc(var(--scroll-p, 0) * -120px), 0)",
        }}
      />
      <svg
        className="absolute inset-x-0 top-0 h-[140%] w-full"
        viewBox="0 0 1440 1200"
        preserveAspectRatio="none"
        style={{ transform: "translate3d(0, calc(var(--scroll-p, 0) * -220px), 0)" }}
      >
        <path
          d="M-40,200 C360,120 620,320 900,220 S1320,120 1480,200"
          fill="none"
          stroke="#ccff00"
          strokeOpacity="0.14"
          strokeWidth="1.5"
        />
        <path
          d="M-40,260 C360,180 620,380 900,280 S1320,180 1480,260"
          fill="none"
          stroke="#ccff00"
          strokeOpacity="0.08"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
