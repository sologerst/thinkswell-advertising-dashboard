import clsx from "clsx";
import { Image as ImageIcon, Layers, Play, Trophy } from "lucide-react";
import { StatusPill } from "@/components/ui";
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

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function creativeKind(name: string) {
  const n = name.toLowerCase();
  if (/(reel|video|trailer|story|ugc)/.test(n)) return { icon: Play, label: "Video" };
  if (/carousel|collection/.test(n)) return { icon: Layers, label: "Carousel" };
  return { icon: ImageIcon, label: "Image" };
}

export function AdCards({ ads, resultMetric, costMetric }: { ads: AdRow[]; resultMetric: MetricDef; costMetric: MetricDef }) {
  const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
  // "Top performer" = best cost per result among ads with a meaningful share of spend.
  const eligible = ads.filter((a) => a.spend >= totalSpend * 0.08 && (costMetric.compute(a) ?? 0) > 0);
  const top = eligible.length > 1 ? eligible.reduce((a, b) => ((costMetric.compute(b) ?? Infinity) < (costMetric.compute(a) ?? Infinity) ? b : a)) : null;

  if (ads.length === 0) return <p className="py-8 text-center text-sm text-fg-3">No ads delivered in this period.</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {ads.map((ad, i) => {
        const kind = creativeKind(ad.name);
        const Icon = kind.icon;
        const isTop = top?.id === ad.id;
        return (
          <div
            key={ad.id}
            className={clsx(
              "tw-card group animate-rise overflow-hidden transition duration-300 hover:-translate-y-0.5",
              isTop && "border-gold/40! shadow-[0_0_0_1px_rgb(247_189_69/0.25),0_20px_50px_-24px_rgb(247_189_69/0.5)]!",
            )}
            style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
          >
            <div className={clsx("relative aspect-[16/10] overflow-hidden bg-gradient-to-br", GRADIENTS[hash(ad.id) % GRADIENTS.length])}>
              {ad.thumbnailUrl ? (
                // Meta CDN URLs are signed and short-lived, so skip next/image optimisation.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ad.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" />
              ) : (
                <>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(255_255_255/0.25),transparent_45%)]" />
                  <div className="absolute inset-x-4 bottom-4">
                    <div className="line-clamp-2 font-serif text-[1.35rem] leading-tight text-white drop-shadow">{ad.title ?? ad.name}</div>
                  </div>
                </>
              )}
              <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[0.65rem] font-bold text-white backdrop-blur">
                <Icon className="size-3" /> {kind.label}
              </span>
              {isTop && (
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-gold px-2 py-1 text-[0.65rem] font-bold text-ink-850">
                  <Trophy className="size-3" /> Top performer
                </span>
              )}
            </div>
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
      })}
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
