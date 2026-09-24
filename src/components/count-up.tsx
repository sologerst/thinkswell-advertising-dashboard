"use client";

import { useEffect, useRef, useState } from "react";
import { formatMetric } from "@/lib/format";
import type { MetricFormat } from "@/lib/metrics/catalog";

/** Rolls a KPI number up from zero on first paint. Server HTML already has the final value. */
export function CountUp({ value, format, duration = 900 }: { value: number | null; format: MetricFormat; duration?: number }) {
  const [shown, setShown] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    if (value === null || started.current) return;
    started.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{formatMetric(shown, format)}</>;
}
