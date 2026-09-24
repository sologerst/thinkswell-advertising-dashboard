import { platformMeta } from "@/components/icons";
import { formatMetric } from "@/lib/format";
import type { MetricDef, Totals } from "@/lib/metrics/catalog";

type Row = Totals & { platform: string };

/**
 * Share-of-total bars per platform (spend, results, impressions), plus each
 * platform's efficiency. Facebook and Instagram get the first two validated
 * series colors; everything else folds into "Other".
 */
export function PlatformSplit({ rows, resultMetric, costMetric }: { rows: Row[]; resultMetric: MetricDef; costMetric: MetricDef }) {
  const folded = foldOther(rows);
  const measures: { label: string; get: (r: Totals) => number; format: MetricDef["format"] }[] = [
    { label: "Spend", get: (r) => r.spend, format: "currency" },
    { label: resultMetric.label, get: (r) => resultMetric.compute(r) ?? 0, format: resultMetric.format },
    { label: "Impressions", get: (r) => r.impressions, format: "number" },
  ];

  if (folded.length === 0) {
    return <p className="py-8 text-center text-sm text-fg-3">No delivery in this period yet.</p>;
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-x-4 gap-y-2" aria-label="Legend">
        {folded.map((r) => {
          const meta = platformMeta(r.platform);
          const Icon = meta.icon;
          return (
            <span key={r.platform} className="inline-flex items-center gap-2 text-xs font-semibold text-fg-2">
              <span className="size-2.5 rounded-sm" style={{ background: meta.color }} />
              {Icon && <Icon className="size-3.5 text-fg-3" />}
              {meta.label}
            </span>
          );
        })}
      </div>

      <div className="space-y-4">
        {measures.map((m) => {
          const total = folded.reduce((s, r) => s + m.get(r), 0);
          return (
            <div key={m.label}>
              <div className="mb-1.5 flex items-baseline justify-between text-xs">
                <span className="font-semibold text-fg-2">{m.label}</span>
                <span className="num text-fg-3">{formatMetric(total, m.format, { compact: true })}</span>
              </div>
              <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
                {total > 0 ? (
                  folded.map((r) => {
                    const v = m.get(r);
                    if (v <= 0) return null;
                    const meta = platformMeta(r.platform);
                    return (
                      <div
                        key={r.platform}
                        title={`${meta.label}: ${formatMetric(v, m.format)} (${Math.round((v / total) * 100)}%)`}
                        className="h-full first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${(v / total) * 100}%`, background: meta.color }}
                      />
                    );
                  })
                ) : (
                  <div className="h-full w-full bg-white/5" />
                )}
              </div>
              {total > 0 && (
                <div className="mt-1 flex gap-4 text-[0.7rem] text-fg-3">
                  {folded.map((r) => (
                    <span key={r.platform} className="num">
                      {platformMeta(r.platform).label} {Math.round((m.get(r) / total) * 100)}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(folded.length, 3)}, minmax(0, 1fr))` }}>
        {folded.map((r) => {
          const meta = platformMeta(r.platform);
          const Icon = meta.icon;
          return (
            <div key={r.platform} className="rounded-2xl border border-line bg-ink-900/60 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-fg">
                {Icon ? <Icon className="size-3.5" style={{ color: meta.color }} /> : <span className="size-2 rounded-sm" style={{ background: meta.color }} />}
                {meta.label}
              </div>
              <Stat label={costMetric.short} value={formatMetric(costMetric.compute(r), costMetric.format)} />
              <Stat label="CTR" value={formatMetric(r.impressions ? r.linkClicks / r.impressions : null, "percent")} />
              <Stat label="CPM" value={formatMetric(r.impressions ? (r.spend / r.impressions) * 1000 : null, "currency")} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5 text-[0.72rem]">
      <span className="text-fg-3">{label}</span>
      <span className="num font-semibold text-fg">{value}</span>
    </div>
  );
}

function foldOther(rows: Row[]): Row[] {
  const main = rows.filter((r) => r.platform === "facebook" || r.platform === "instagram");
  const rest = rows.filter((r) => r.platform !== "facebook" && r.platform !== "instagram");
  const order = (p: string) => (p === "facebook" ? 0 : 1);
  const out = [...main].sort((a, b) => order(a.platform) - order(b.platform));
  if (rest.length) {
    const other = { ...rest[0]!, platform: "unknown" } as Row;
    for (const r of rest.slice(1)) for (const k of Object.keys(r) as (keyof Row)[]) if (k !== "platform") (other[k] as number) += r[k] as number;
    if (other.spend > 0 || other.impressions > 0) out.push(other);
  }
  return out;
}
