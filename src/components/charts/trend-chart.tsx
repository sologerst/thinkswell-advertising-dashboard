"use client";

import clsx from "clsx";
import { useId, useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtDay, fmtWeekday } from "@/lib/dates";
import { formatAxis, formatDelta, formatMetric, pctChange } from "@/lib/format";
import type { MetricFormat } from "@/lib/metrics/catalog";

export type TrendMetric = {
  key: string;
  label: string;
  format: MetricFormat;
  color: string;
  better: "up" | "down" | "neutral";
  values: (number | null)[];
  prev: (number | null)[];
};

type Point = { date: string; prevDate: string | null; cur: number | null; prev: number | null };

export function TrendChart({ dates, prevDates, metrics, height = 300 }: { dates: string[]; prevDates: string[]; metrics: TrendMetric[]; height?: number }) {
  const [active, setActive] = useState(metrics[0]?.key);
  const m = metrics.find((x) => x.key === active) ?? metrics[0];
  const gid = useId().replace(/:/g, "");

  const data: Point[] = useMemo(
    () => (m ? dates.map((d, i) => ({ date: d, prevDate: prevDates[i] ?? null, cur: m.values[i] ?? null, prev: m.prev[i] ?? null })) : []),
    [m, dates, prevDates],
  );
  if (!m) return null;

  const single = dates.length === 1;
  const ticks = niceTicks(Math.max(0, ...data.flatMap((p) => [p.cur ?? 0, p.prev ?? 0])));

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1.5" role="tablist" aria-label="Metric">
        {metrics.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={x.key === m.key}
            onClick={() => setActive(x.key)}
            className={clsx(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              x.key === m.key ? "border-transparent bg-white/10 text-fg" : "border-line text-fg-3 hover:border-line-strong hover:text-fg-2",
            )}
          >
            <span className="size-2 rounded-full" style={{ background: x.color }} />
            {x.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-5 text-xs text-fg-2">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full" style={{ background: m.color }} />
          This period
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded-full bg-fg-3/70" />
          Previous period
        </span>
      </div>

      <div style={{ height }} className="-ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`fill${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={m.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={m.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#232a42" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => fmtDay(d)}
              tick={{ fill: "#8290a8", fontSize: 11 }}
              axisLine={{ stroke: "#313956" }}
              tickLine={false}
              minTickGap={24}
              padding={{ left: 8, right: 8 }}
            />
            <YAxis
              tickFormatter={(v: number) => formatAxis(v, m.format)}
              tick={{ fill: "#8290a8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={62}
              ticks={ticks}
              domain={[0, ticks[ticks.length - 1]!]}
            />
            <Tooltip
              cursor={{ stroke: "#b9c2d3", strokeOpacity: 0.35, strokeWidth: 1 }}
              content={({ active: on, payload }) => {
                const p = on && payload?.[0] ? (payload[0].payload as Point) : null;
                if (!p) return null;
                const d = pctChange(p.cur, p.prev);
                const good = m.better === "neutral" || d === null ? null : (m.better === "up") === d > 0;
                return (
                  <div className="min-w-44 rounded-xl border border-line-strong bg-ink-750/95 p-3 text-xs shadow-2xl backdrop-blur">
                    <div className="mb-2 font-semibold text-fg">
                      {fmtWeekday(p.date)}, {fmtDay(p.date)}
                    </div>
                    <Row color={m.color} label={m.label} value={formatMetric(p.cur, m.format)} strong />
                    {p.prevDate && <Row color="#8290a8" label={`${fmtDay(p.prevDate)} (prev.)`} value={formatMetric(p.prev, m.format)} />}
                    {d !== null && (
                      <div className={clsx("mt-2 border-t border-line pt-2 font-semibold", good === true ? "text-good" : good === false ? "text-bad" : "text-fg-2")}>
                        {formatDelta(d)} vs previous
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="prev"
              stroke="#8290a8"
              strokeOpacity={0.55}
              strokeWidth={1.5}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="cur"
              stroke={m.color}
              strokeWidth={2.25}
              fill={`url(#fill${gid})`}
              dot={single ? { r: 5, fill: m.color, stroke: "#151a2c", strokeWidth: 2 } : false}
              activeDot={{ r: 5, fill: m.color, stroke: "#151a2c", strokeWidth: 2 }}
              animationDuration={700}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** 0-based "nice" axis ticks (steps of 1, 2, 2.5 or 5 × 10ⁿ). */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}

function Row({ color, label, value, strong }: { color: string; label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="inline-flex items-center gap-2 text-fg-2">
        <span className="size-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className={clsx("num", strong ? "font-semibold text-fg" : "text-fg-2")}>{value}</span>
    </div>
  );
}
