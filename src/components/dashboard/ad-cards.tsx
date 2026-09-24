import clsx from "clsx";
import { ChevronDown, Image as ImageIcon, Layers, PauseCircle, Play, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { AdMediaView } from "@/components/dashboard/ad-media";
import { StatusPill } from "@/components/ui";
import { isAdOff, type CreativeKind } from "@/lib/creative";
import { formatMetric } from "@/lib/format";
import type { MetricDef } from "@/lib/metrics/catalog";
import type { AdRow } from "@/lib/metrics/query";

const GRADIENTS = [
  "from-[#49cbed] via-[#2b5fa8] to-[#111522]",
  "from-[#f7bd45] via-[#c0532f] to-[#111522]",
  "from-[#a47cff] via-[#5a2aa3] to-[#111522]",
  "from-[#ff5a36] via-[#8a2a5e] to-[#111522]",
  "from-[#49cbed] via-[#7434ca] to-[#111522]",
];

const KINDS: Record<CreativeKind, { icon: typeof Play; label: string }> = {
  video: { icon: Play, label: "Video" },
  carousel: { icon: Layers, label: "Carousel" },
  image: { icon: ImageIcon, label: "Image" },
};

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

type Metrics = { resultMetric: MetricDef; costMetric: MetricDef };

export function AdCards({ ads, resultMetric, costMetric }: { ads: AdRow[] } & Metrics) {
  if (ads.length === 0) return <p className="py-8 text-center text-sm text-fg-3">No ads delivered in this period.</p>;

  const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
  // "Top performer" = best cost per result among ads with a meaningful share of spend.
  const eligible = ads.filter((a) => a.spend >= totalSpend * 0.08 && (costMetric.compute(a) ?? 0) > 0);
  const top = eligible.length > 1 ? eligible.reduce((a, b) => ((costMetric.compute(b) ?? Infinity) < (costMetric.compute(a) ?? Infinity) ? b : a)) : null;

  const live = ads.filter((a) => !isAdOff(a.status));
  const off = ads.filter((a) => isAdOff(a.status));
  const offSpend = off.reduce((s, a) => s + a.spend, 0);
  const metrics = { resultMetric, costMetric };

  return (
    <div className="space-y-6">
      {live.length > 0 ? (
        <AdGrid>
          {live.map((ad, i) => (
            <AdCard key={ad.id} ad={ad} index={i} isTop={top?.id === ad.id} {...metrics} />
          ))}
        </AdGrid>
      ) : (
        <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-fg-2">
          Nothing is running in this campaign right now. Here&apos;s how its ads performed in this period.
        </p>
      )}

      {off.length > 0 && (
        <details className="group/paused" open={live.length === 0}>
          <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl border border-line bg-white/[0.02] px-4 py-3 transition hover:border-line-strong hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold/10 text-gold">
              <PauseCircle className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-fg">
                Paused &amp; ended <span className="ml-1 rounded-full bg-white/8 px-2 py-0.5 text-xs text-fg-2">{off.length}</span>
              </span>
              <span className="block text-xs text-fg-3">{formatMetric(offSpend, "currency")} spent in this period</span>
            </span>
            <span className="text-xs font-semibold text-fg-2">
              <span className="group-open/paused:hidden">Show</span>
              <span className="hidden group-open/paused:inline">Hide</span>
            </span>
            <ChevronDown className="size-4 text-fg-3 transition group-open/paused:rotate-180" />
          </summary>
          <AdGrid className="mt-4">
            {off.map((ad, i) => (
              <AdCard key={ad.id} ad={ad} index={i} isTop={top?.id === ad.id} dimmed {...metrics} />
            ))}
          </AdGrid>
        </details>
      )}
    </div>
  );
}

function AdGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4", className)}>{children}</div>;
}

function AdCard({ ad, index, isTop, dimmed, resultMetric, costMetric }: { ad: AdRow; index: number; isTop: boolean; dimmed?: boolean } & Metrics) {
  const kind = KINDS[ad.media.kind];
  const Icon = kind.icon;
  const cardCount = ad.media.cards.length;
  return (
    <div
      className={clsx(
        "tw-card group animate-rise overflow-hidden transition duration-300 hover:-translate-y-0.5",
        isTop && "border-gold/40! shadow-[0_0_0_1px_rgb(247_189_69/0.25),0_20px_50px_-24px_rgb(247_189_69/0.5)]!",
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      <AdMediaView media={ad.media} title={ad.title ?? ad.name} placeholderClass={GRADIENTS[hash(ad.id) % GRADIENTS.length]!} dimmed={dimmed}>
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[0.65rem] font-bold text-white backdrop-blur">
          <Icon className="size-3" /> {kind.label}
          {cardCount > 1 && <span className="font-medium text-white/70">· {cardCount}</span>}
        </span>
        {isTop && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-gold px-2 py-1 text-[0.65rem] font-bold text-ink-850">
            <Trophy className="size-3" /> Top performer
          </span>
        )}
      </AdMediaView>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-fg" title={ad.name}>
              {ad.name}
            </div>
            {ad.adSetName && <div className="truncate text-xs text-fg-3">{ad.adSetName}</div>}
          </div>
          <StatusPill status={ad.status} />
        </div>
        {ad.body && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-fg-2">{ad.body}</p>}
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line pt-3">
          <Stat label="Spend" value={formatMetric(ad.spend, "currency")} />
          <Stat label={resultMetric.short} value={formatMetric(resultMetric.compute(ad), resultMetric.format)} strong />
          <Stat label={costMetric.short} value={formatMetric(costMetric.compute(ad), costMetric.format)} />
          <Stat label="CTR" value={formatMetric(ad.impressions ? ad.linkClicks / ad.impressions : null, "percent")} />
        </dl>
      </div>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-[0.65rem] font-semibold tracking-wider text-fg-3 uppercase">{label}</dt>
      <dd className={clsx("num text-sm", strong ? "font-bold text-fg" : "font-medium text-fg-2")}>{value}</dd>
    </div>
  );
}
