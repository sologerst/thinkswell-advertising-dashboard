import clsx from "clsx";
import { Ban, Heart, Info, MapPin, MonitorSmartphone, Target, Trophy, Users, type LucideIcon } from "lucide-react";
import { StatusPill } from "@/components/ui";
import { formatMetric } from "@/lib/format";
import type { MetricDef } from "@/lib/metrics/catalog";
import type { AdSetRow } from "@/lib/metrics/query";
import { optimizationGoalLabel, summarizeTargeting, type TargetingRowKind } from "@/lib/targeting";

type Metrics = { resultMetric: MetricDef; costMetric: MetricDef };

const ROW_ICONS: Record<TargetingRowKind, LucideIcon> = {
  locations: MapPin,
  people: Users,
  audiences: Target,
  interests: Heart,
  excluding: Ban,
  placements: MonitorSmartphone,
};

/** Chips shown before the rest of a list folds into "+N more". */
const VISIBLE_CHIPS = 8;

/** One card per ad set: its results for the period, then who it targets and where it runs. */
export function AdSetCards({ adSets, resultMetric, costMetric }: { adSets: AdSetRow[] } & Metrics) {
  if (adSets.length === 0) return <p className="py-8 text-center text-sm text-fg-3">Nothing delivered in this period.</p>;

  const totalSpend = adSets.reduce((s, a) => s + a.spend, 0);
  // Same rule as ads' "Top performer": best cost per result among ad sets with a meaningful share of spend.
  const eligible = adSets.filter((a) => a.spend >= totalSpend * 0.08 && (costMetric.compute(a) ?? 0) > 0);
  const best = eligible.length > 1 ? eligible.reduce((a, b) => ((costMetric.compute(b) ?? Infinity) < (costMetric.compute(a) ?? Infinity) ? b : a)) : null;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {adSets.map((s, i) => (
        <AdSetCard key={s.id} adSet={s} index={i} share={totalSpend > 0 ? s.spend / totalSpend : 0} isBest={best?.id === s.id} resultMetric={resultMetric} costMetric={costMetric} />
      ))}
    </div>
  );
}

function AdSetCard({ adSet, index, share, isBest, resultMetric, costMetric }: { adSet: AdSetRow; index: number; share: number; isBest: boolean } & Metrics) {
  const targeting = summarizeTargeting(adSet.targeting);
  const optimizedFor = optimizationGoalLabel(adSet.optimizationGoal);
  return (
    <div
      className={clsx(
        "tw-card animate-rise flex flex-col p-5",
        isBest && "border-gold/40! shadow-[0_0_0_1px_rgb(247_189_69/0.25),0_20px_50px_-24px_rgb(247_189_69/0.5)]!",
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[0.95rem] leading-snug font-semibold text-fg">{adSet.name}</h3>
          <p className="mt-0.5 text-xs text-fg-3">
            {optimizedFor && <>Optimized for {optimizedFor} · </>}
            {formatMetric(adSet.adCount, "number")} {adSet.adCount === 1 ? "ad" : "ads"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {isBest && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[0.65rem] font-bold text-ink-850">
              <Trophy className="size-3" /> Best cost
            </span>
          )}
          <StatusPill status={adSet.status} />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-x-3 gap-y-3 sm:grid-cols-5">
        <Stat label="Spend" value={formatMetric(adSet.spend, "currency")} />
        <Stat label={resultMetric.short} value={formatMetric(resultMetric.compute(adSet), resultMetric.format)} strong />
        <Stat label={costMetric.short} value={formatMetric(costMetric.compute(adSet), costMetric.format)} />
        <Stat label="CTR" value={formatMetric(adSet.impressions ? adSet.linkClicks / adSet.impressions : null, "percent")} />
        <Stat label="Reach" value={formatMetric(adSet.reach, "number", { compact: true })} />
      </dl>
      <div className="mt-3 flex items-center gap-3 text-xs text-fg-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-series-1" style={{ width: `${Math.max(2, share * 100)}%` }} />
        </div>
        <span className="num shrink-0">{Math.round(share * 100)}% of campaign spend</span>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <div className="eyebrow mb-3">Targeting</div>
        {targeting ? (
          <dl className="space-y-3">
            {targeting.rows.map((row) => {
              const Icon = ROW_ICONS[row.kind];
              return (
                <div key={row.kind} className="gap-3 sm:grid sm:grid-cols-[7rem_1fr]">
                  <dt className="mb-1.5 flex items-center gap-1.5 self-start text-xs font-semibold text-fg-2 sm:mb-0 sm:pt-1">
                    <Icon className={clsx("size-3.5", row.kind === "excluding" ? "text-bad" : "text-cyan")} />
                    {row.label}
                  </dt>
                  <dd className="min-w-0">
                    {row.groups.map((group, gi) => (
                      <div key={gi}>
                        {gi > 0 && <div className="my-1.5 text-[0.65rem] font-bold tracking-wider text-fg-3 uppercase">and also</div>}
                        <Chips items={group} tone={row.kind === "excluding" ? "bad" : "default"} />
                      </div>
                    ))}
                    {row.note && <p className="mt-1.5 text-xs text-fg-3">{row.note}</p>}
                  </dd>
                </div>
              );
            })}
            {targeting.advantageAudience && (
              <p className="flex items-start gap-1.5 rounded-xl bg-cyan/[0.07] px-3 py-2 text-xs text-fg-2">
                <Info className="mt-0.5 size-3.5 shrink-0 text-cyan" />
                Advantage+ audience is on: Meta treats these settings as a starting point and can reach beyond them when it expects better results.
              </p>
            )}
          </dl>
        ) : (
          <p className="text-xs text-fg-3">Targeting details for this ad set aren&apos;t available yet. They&apos;ll appear after the next data sync.</p>
        )}
      </div>
    </div>
  );
}

function Chips({ items, tone }: { items: string[]; tone: "default" | "bad" }) {
  const chip = clsx(
    "inline-flex max-w-full rounded-full border px-2.5 py-1 text-xs leading-tight",
    tone === "bad" ? "border-bad/25 bg-bad/[0.06] text-fg-2" : "border-line bg-white/[0.04] text-fg",
  );
  const shown = items.slice(0, VISIBLE_CHIPS);
  const rest = items.slice(VISIBLE_CHIPS);
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((item) => (
        <span key={item} className={chip}>
          {item}
        </span>
      ))}
      {rest.length > 0 && (
        <details className="group/more open:basis-full">
          <summary className="inline-flex cursor-pointer list-none rounded-full px-2 py-1 text-xs font-semibold text-cyan group-open/more:hidden hover:underline [&::-webkit-details-marker]:hidden">
            +{rest.length} more
          </summary>
          <div className="flex flex-wrap gap-1.5">
            {rest.map((item) => (
              <span key={item} className={chip}>
                {item}
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[0.65rem] font-semibold tracking-wider text-fg-3 uppercase">{label}</dt>
      <dd className={clsx("num text-sm", strong ? "font-bold text-fg" : "font-medium text-fg-2")}>{value}</dd>
    </div>
  );
}
