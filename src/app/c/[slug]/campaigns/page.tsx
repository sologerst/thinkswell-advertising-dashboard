import type { Metadata } from "next";
import { CampaignTable } from "@/components/dashboard/campaign-table";
import { DashboardHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui";
import { requireClientAccess } from "@/lib/auth/current";
import { fmtRange } from "@/lib/dates";
import { formatMetric } from "@/lib/format";
import { GOAL_PRESETS, getMetric } from "@/lib/metrics/catalog";
import { getByCampaign, getCampaignDaily, loadScope, sumRows } from "@/lib/metrics/query";
import { resultFieldFor } from "@/lib/metrics/report";
import { keepQuery, readDashboardParams } from "@/lib/params";

export const metadata: Metadata = { title: "Campaigns" };

const SECONDARY: Record<string, string> = { sales: "roas", leads: "leadRate", awareness: "cpm", traffic: "landingPageViews" };

export default async function CampaignsPage({ params, searchParams }: PageProps<"/c/[slug]/campaigns">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { client } = await requireClientAccess(slug);
  const { today, range, platform } = readDashboardParams(sp);
  const scope = await loadScope(client);
  const preset = GOAL_PRESETS[client.goal];
  const resultMetric = getMetric(preset.result)!;
  const costMetric = getMetric(preset.costPerResult)!;
  const secondary = getMetric(SECONDARY[client.goal]!)!;
  const f = { from: range.from, to: range.to, platform };

  const [rows, sparks] = await Promise.all([getByCampaign(scope, f), getCampaignDaily(scope, f, resultFieldFor(preset.result))]);
  const totals = sumRows(rows);
  const live = rows.filter((r) => r.status?.toUpperCase() === "ACTIVE").length;
  const q = keepQuery(sp);

  return (
    <>
      <DashboardHeader
        eyebrow={
          <>
            <span className="text-cyan">{client.name}</span>
            <span className="text-fg-3/60">•</span>
            <span>{range.label}</span>
          </>
        }
        title="Campaigns"
        subtitle={<span>{fmtRange(range.from, range.to)}</span>}
        range={range}
        platform={platform}
        today={today}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Campaigns with delivery" value={String(rows.length)} />
        <Stat label="Live right now" value={String(live)} accent="text-good" />
        <Stat label="Total spend" value={formatMetric(totals.spend, "currency")} />
        <Stat label={`Total ${resultMetric.label.toLowerCase()}`} value={formatMetric(resultMetric.compute(totals), resultMetric.format)} />
      </div>

      <Card className="p-5 sm:p-6">
        <CampaignTable
          searchable
          rows={rows.map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            objective: c.objective,
            spend: c.spend,
            result: resultMetric.compute(c),
            cost: costMetric.compute(c),
            ctr: c.impressions ? c.linkClicks / c.impressions : null,
            secondary: secondary.compute(c),
            spark: sparks.get(c.id) ?? [],
            href: `/c/${slug}/campaigns/${encodeURIComponent(c.id)}${q}`,
          }))}
          resultLabel={resultMetric.short}
          resultFormat={resultMetric.format}
          costLabel={costMetric.short}
          secondaryLabel={secondary.short}
          secondaryFormat={secondary.format}
        />
      </Card>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="tw-card animate-rise px-4 py-3.5">
      <div className="text-xs text-fg-3">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${accent ?? "text-fg"}`}>{value}</div>
    </div>
  );
}
