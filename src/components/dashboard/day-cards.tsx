import clsx from "clsx";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { fmtDay, fmtWeekday, type ISODate } from "@/lib/dates";
import { formatMetric } from "@/lib/format";
import type { MetricDef } from "@/lib/metrics/catalog";

export type DayCardData = { date: ISODate; spend: number; result: number | null; cost: number | null };

export function DayCards({
  days,
  resultMetric,
  costMetric,
  today,
  hrefFor,
  maxDays = 31,
}: {
  days: DayCardData[];
  resultMetric: MetricDef;
  costMetric: MetricDef;
  today: ISODate;
  hrefFor: (date: ISODate) => string;
  maxDays?: number;
}) {
  const shown = [...days].reverse().slice(0, maxDays);
  const maxResult = Math.max(0, ...shown.map((d) => d.result ?? 0));
  const maxSpend = Math.max(0, ...shown.map((d) => d.spend));
  const best = maxResult > 0 ? shown.find((d) => d.result === maxResult)?.date : undefined;

  return (
    <div className="scrollbar-thin -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pt-1 pb-3">
      {shown.map((d, i) => {
        const isBest = d.date === best && shown.length > 1;
        return (
          <Link
            key={d.date}
            href={hrefFor(d.date)}
            scroll={false}
            className={clsx(
              "tw-card group animate-rise w-[172px] shrink-0 snap-start p-4 transition duration-300 hover:-translate-y-0.5 hover:border-cyan/40",
              isBest && "border-gold/40! shadow-[0_0_0_1px_rgb(247_189_69/0.25),0_16px_40px_-18px_rgb(247_189_69/0.45)]!",
            )}
            style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-fg">{d.date === today ? "Today" : fmtWeekday(d.date)}</div>
                <div className="text-xs text-fg-3">{fmtDay(d.date)}</div>
              </div>
              {isBest && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[0.65rem] font-bold text-gold">
                  <Sparkles className="size-3" /> Best
                </span>
              )}
              {d.date === today && !isBest && (
                <span className="inline-flex items-center gap-1 rounded-full bg-cyan/15 px-2 py-0.5 text-[0.65rem] font-bold text-cyan">
                  <span className="size-1.5 animate-pulse rounded-full bg-cyan" /> Live
                </span>
              )}
            </div>
            <div className="mt-4 text-[1.35rem] leading-none font-semibold text-fg">{formatMetric(d.spend, "currency")}</div>
            <div className="mt-1 text-[0.7rem] font-medium tracking-wide text-fg-3 uppercase">spent</div>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-fg">
                {formatMetric(d.result, resultMetric.format, { compact: true })}{" "}
                <span className="font-normal text-fg-3">{resultMetric.short.toLowerCase()}</span>
              </span>
            </div>
            <div className="text-xs text-fg-2">{d.cost !== null ? `${formatMetric(d.cost, costMetric.format)} ${costLabel(costMetric)}` : " "}</div>
            <div className="mt-3 space-y-1">
              <Bar value={d.spend} max={maxSpend} color="var(--color-series-1)" label="Spend" />
              <Bar value={d.result ?? 0} max={maxResult} color="var(--color-series-2)" label={resultMetric.short} />
            </div>
          </Link>
        );
      })}
      {days.length > maxDays && (
        <div className="flex w-40 shrink-0 items-center justify-center rounded-3xl border border-dashed border-line p-4 text-center text-xs text-fg-3">
          Showing the latest {maxDays} days. The chart above has the full range.
        </div>
      )}
    </div>
  );
}

function costLabel(m: MetricDef) {
  if (m.key === "cpm") return "CPM";
  if (m.key === "cpc") return "per click";
  return "each";
}

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5" title={label}>
      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
