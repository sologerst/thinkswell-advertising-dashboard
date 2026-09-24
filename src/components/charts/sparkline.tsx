import { useId } from "react";

/**
 * Tiny, dependency-free trend line for stat tiles and table rows.
 * Renders on the server; nulls (e.g. CPA on a zero-conversion day) break the line.
 */
export function Sparkline({
  values,
  color = "var(--color-cyan)",
  width = 120,
  height = 36,
  fill = true,
  className,
}: {
  values: (number | null)[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (nums.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden />;
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const pad = 3;
  const span = max - min || 1;
  const step = (width - pad * 2) / Math.max(1, values.length - 1);
  const pts = values.map((v, i) =>
    v === null || !Number.isFinite(v) ? null : ([pad + i * step, pad + (height - pad * 2) * (1 - (v - min) / span)] as const),
  );

  let line = "";
  let started = false;
  for (const p of pts) {
    if (!p) {
      started = false;
      continue;
    }
    line += `${started ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)} `;
    started = true;
  }
  const valid = pts.filter(Boolean) as (readonly [number, number])[];
  const first = valid[0]!;
  const last = valid[valid.length - 1]!;
  const area = `${line} L${last[0].toFixed(1)} ${height} L${first[0].toFixed(1)} ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className} aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#g${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} stroke="var(--color-ink-800)" strokeWidth="2" />
    </svg>
  );
}
