import type { Metadata } from "next";
import { CampaignTable } from "@/components/dashboard/campaign-table";
import { GroupTabs } from "@/components/dashboard/group-tabs";
import { DashboardHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui";
import { loadClientContext } from "@/lib/client-context";
import { fmtRange } from "@/lib/dates";
import { formatMetric } from "@/lib/format";
import { GOAL_PRESETS, getMetric } from "@/lib/metrics/catalog";
import { sumRows } from "@/lib/metrics/query";
import { campaignViews } from "@/lib/metrics/report";
import { keepQuery, readDashboardParams } from "@/lib/params";

export const metadata: Metadata = { title: "Campaigns" };

const SECONDARY: Record<string, string> = { sales: "roas", leads: "leadRate", awareness: "cpm", traffic: "landingPageViews" };

export default async function CampaignsPage({ params, searchParams }: PageProps<"/c/[slug]/campaigns">) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await loadClientContext(slug);
  const { client } = ctx;
  const { today, range, platform } = readDashboardParams(sp);
  const { group, scope, setup } = ctx.view(typeof sp.group === "string" ? sp.group : null);
  const preset = GOAL_PRESETS[setup.goal];
  const resultMetric = getMetric(preset.result)!;
  const costMetric = getMetric(preset.costPerResult)!;

  const rows = await campaignViews(scope, { from: range.from, to: range.to, platform }, ctx);
  const mixed = new Set(rows.map((r) => r.goal)).size > 1;
  // The extra column only makes sense when every campaign shares one goal.
  const secondary = mixed ? null : getMetric(SECONDARY[rows[0]?.goal ?? setup.goal]!)!;
  const totals = sumRows(rows);
  const live = rows.filter((r) => r.status?.toUpperCase() === "ACTIVE").length;
  const q = keepQuery(sp);
  const totalResults = mixed ? null : rows.reduce((s, r) => s + (r.result ?? 0), 0);

  return (
    <>
      <DashboardHeader
        eyebrow={
          <>
            <span className="text-cyan">{client.name}</span>
            {group && (
              <>
                <span className="text-fg-3/60">•</span>
                <span className="text-gold">{group.name}</span>
              </>
            )}
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
      <GroupTabs
        groups={ctx.groups}
        active={group?.id ?? null}
        clientGoal={client.goal}
        hrefFor={(id) => `/c/${slug}/campaigns${keepQuery(sp, { group: id })}`}
        allLabel={ctx.restricted ? "Everything shared with you" : "All campaigns"}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Campaigns with delivery" value={String(rows.length)} />
        <Stat label="Live right now" value={String(live)} accent="text-good" />
        <Stat label="Total spend" value={formatMetric(totals.spend, "currency")} />
        {totalResults !== null ? (
          <Stat label={`Total ${preset.unit}`} value={formatMetric(totalResults, resultMetric.format)} />
        ) : (
          <Stat label="Groups" value={String(new Set(rows.map((r) => r.groupId).filter(Boolean)).size || "—")} />
        )}
      </div>

      <Card className="p-5 sm:p-6">
        <CampaignTable
          searchable
          mixed={mixed}
          groups={group ? undefined : ctx.groups.map((g) => ({ id: g.id, name: g.name }))}
          rows={rows.map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            objective: c.objective,
            spend: c.spend,
            result: c.result,
            cost: c.cost,
            resultUnit: c.resultUnit,
            costUnit: c.costUnit,
            ctr: c.impressions ? c.linkClicks / c.impressions : null,
            secondary: secondary ? secondary.compute(c) : null,
            spark: c.spark,
            href: `/c/${slug}/campaigns/${encodeURIComponent(c.id)}${q}`,
            groupId: c.groupId,
          }))}
          resultLabel={resultMetric.short}
          resultFormat={resultMetric.format}
          costLabel={costMetric.short}
          secondaryLabel={secondary?.short}
          secondaryFormat={secondary?.format}
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
