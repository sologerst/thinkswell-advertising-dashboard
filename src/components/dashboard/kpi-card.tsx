import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { Sparkline } from "@/components/charts/sparkline";
import { CountUp } from "@/components/count-up";
import { MetricIcon } from "@/components/icons";
import { formatDelta } from "@/lib/format";
import type { Accent, MetricDef } from "@/lib/metrics/catalog";

export const ACCENT_HEX: Record<Accent, string> = {
  cyan: "#49cbed",
  gold: "#f7bd45",
  purple: "#a47cff",
  coral: "#ff7a5c",
};

export function DeltaBadge({ delta, better, compareLabel }: { delta: number | null; better: MetricDef["better"]; compareLabel?: string }) {
  if (delta === null) return <span className="text-xs text-fg-3">No comparison yet</span>;
  const flat = Math.abs(delta) < 0.005;
  const up = delta > 0;
  const good = better === "neutral" || flat ? null : (better === "up") === up;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={clsx(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
          good === true && "bg-good/12 text-good",
          good === false && "bg-bad/12 text-bad",
          good === null && "bg-white/6 text-fg-2",
        )}
      >
        <Icon className="size-3.5" strokeWidth={2.5} />
        {formatDelta(delta)}
      </span>
      {compareLabel && <span className="hidden text-fg-3 sm:inline">{compareLabel}</span>}
    </span>
  );
}

export function KpiCard({
  label,
  help,
  icon,
  accent,
  value,
  format,
  delta,
  better,
  spark,
  compareLabel,
  footer,
  index = 0,
  size = "md",
}: {
  label: string;
  help?: string;
  icon: string;
  accent: Accent;
  value: number | null;
  format: MetricDef["format"];
  delta: number | null;
  better: MetricDef["better"];
  spark: (number | null)[];
  compareLabel?: string;
  footer?: ReactNode;
  index?: number;
  size?: "md" | "lg";
}) {
  const color = ACCENT_HEX[accent];
  return (
    <div
      className={clsx(
        "tw-card group animate-rise p-4 transition duration-300 hover:-translate-y-0.5 hover:border-[var(--kpi-border)] hover:shadow-[0_0_0_1px_var(--kpi-soft),0_18px_50px_-18px_var(--kpi-glow)] sm:p-5",
        size === "lg" && "col-span-2 sm:col-span-1",
      )}
      style={
        {
          "--kpi-border": `${color}66`,
          "--kpi-soft": `${color}33`,
          "--kpi-glow": `${color}66`,
          animationDelay: `${index * 55}ms`,
        } as React.CSSProperties
      }
    >
      {/* Glow is clipped on its own layer so the help tooltip can overflow the card. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div
          className="absolute -top-16 -right-16 size-40 rounded-full opacity-[0.10] blur-2xl transition-opacity duration-500 group-hover:opacity-25"
          style={{ background: color }}
        />
      </div>
      <div className="relative flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-xl sm:size-8" style={{ background: `${color}1f`, color }}>
            <MetricIcon name={icon} className="size-4" />
          </span>
          <span className="truncate text-[0.78rem] font-semibold text-fg-2 sm:text-[0.8rem]">{label}</span>
        </div>
        {help && (
          <span className="group/tip relative hidden sm:block">
            <Info className="size-4 text-fg-3 transition hover:text-fg-2" aria-label={help} />
            <span className="pointer-events-none absolute top-6 right-0 z-20 w-56 rounded-xl border border-line-strong bg-ink-750 p-3 text-xs leading-relaxed text-fg-2 opacity-0 shadow-xl transition group-hover/tip:opacity-100">
              {help}
            </span>
          </span>
        )}
      </div>
      <div
        className={clsx(
          "relative mt-3 leading-none font-semibold tracking-tight text-fg sm:mt-4",
          size === "lg" ? "text-[2.1rem] sm:text-[2.35rem]" : "text-[1.45rem] sm:text-[1.9rem]",
        )}
      >
        <CountUp value={value} format={format} />
      </div>
      <div className="relative mt-3 flex flex-wrap items-end justify-between gap-2">
        <DeltaBadge delta={delta} better={better} compareLabel={compareLabel} />
        <Sparkline values={spark} color={color} width={96} height={32} className={clsx("shrink-0", size !== "lg" && "hidden sm:block")} />
      </div>
      {footer && <div className="relative mt-4 border-t border-line pt-3 text-xs text-fg-2">{footer}</div>}
    </div>
  );
}
