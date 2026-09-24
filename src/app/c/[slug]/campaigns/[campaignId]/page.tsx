import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrendChart, type TrendMetric } from "@/components/charts/trend-chart";
import { AdCards } from "@/components/dashboard/ad-cards";
import { BreakdownTable } from "@/components/dashboard/breakdown-table";
import { ACCENT_HEX, KpiCard } from "@/components/dashboard/kpi-card";
import { DashboardHeader } from "@/components/dashboard/page-header";
import { PlatformSplit } from "@/components/dashboard/platform-split";
import { Card, SectionTitle, StatusPill } from "@/components/ui";
import { loadClientContext, setupFor } from "@/lib/client-context";
import { getDb } from "@/lib/db";
import { adAccounts } from "@/lib/db/schema";
import { addDays, fmtDayYear, fmtRange, fmtWeekday } from "@/lib/dates";
import { formatMetric, titleCase } from "@/lib/format";
import { GOAL_PRESETS, getMetric } from "@/lib/metrics/catalog";
import { getByAd, getByAdSet, getByPlatform, getCampaignInScope, getDaily, sumRows } from "@/lib/metrics/query";
import { clientKpis, kpiFor } from "@/lib/metrics/report";
import { keepQuery, readDashboardParams } from "@/lib/params";

type Props = PageProps<"/c/[slug]/campaigns/[campaignId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, campaignId } = await params;
  const ctx = await loadClientContext(slug);
  const id = decodeURIComponent(campaignId);
  const c = await getCampaignInScope(ctx.scope, id);
  return { title: c ? `${ctx.nameFor(id, c.name)} · ${ctx.client.name}` : ctx.client.name };
}

export default async function CampaignPage({ params, searchParams }: Props) {
  const { slug, campaignId: rawId } = await params;
  const campaignId = decodeURIComponent(rawId);
  const sp = await searchParams;
  const ctx = await loadClientContext(slug);
  const { client, scope } = ctx;
  const { today, range, platform } = readDashboardParams(sp);
  // The scope already excludes campaigns this person isn't allowed to see.
  const campaign = await getCampaignInScope(scope, campaignId);
  if (!campaign) notFound();

  const setup = setupFor(client, ctx.goalFor(campaignId));
  const group = ctx.groupFor(campaignId);
  const displayName = ctx.nameFor(campaignId, campaign.name);
  const preset = GOAL_PRESETS[setup.goal];
  const resultMetric = getMetric(preset.result)!;
  const costMetric = getMetric(preset.costPerResult)!;
  const f = { from: range.from, to: range.to, platform, campaignId };

  const db = await getDb();
  const [daily, prevDaily, allDaily, adSetRows, adRows, platforms, account] = await Promise.all([
    getDaily(scope, f),
    getDaily(scope, { ...f, from: range.prevFrom, to: range.prevTo }),
    getDaily(scope, { from: range.from, to: range.to, platform }),
    getByAdSet(scope, f),
    getByAd(scope, f),
    getByPlatform(scope, { from: range.from, to: range.to, campaignId }),
    campaign.accountId ? db.select({ name: adAccounts.name }).from(adAccounts).where(eq(adAccounts.id, campaign.accountId)) : Promise.resolve([]),
  ]);

  const cur = sumRows(daily);
  const prev = sumRows(prevDaily);
  const all = sumRows(allDaily);
  const spend = kpiFor(getMetric("spend")!, cur, prev, daily);
  const kpis = clientKpis(setup).map((m) => kpiFor(m, cur, prev, daily));
  const compareLabel = "vs prev. period";
  const share = all.spend > 0 ? cur.spend / all.spend : null;

  const trendMetrics: TrendMetric[] = [spend, ...kpis].slice(0, 7).map((k) => {
    const def = getMetric(k.key)!;
    return {
      key: k.key,
      label: def.short,
      format: def.format,
      color: ACCENT_HEX[def.accent],
      better: def.better,
      values: daily.map((d) => def.compute(d)),
      prev: prevDaily.map((d) => def.compute(d)),
    };
  });

  const ended = campaign.status === "COMPLETED" || (campaign.lastDate < addDays(today, -2) && campaign.status !== "ACTIVE");
  const flight = ended ? `Ran ${fmtRange(campaign.firstDate, campaign.lastDate)}` : `Running since ${fmtDayYear(campaign.firstDate)}`;

  return (
    <>
      <Link
        href={`/c/${slug}/campaigns${keepQuery(sp, { group: group && ctx.groups.some((g) => g.id === group.id) ? group.id : null })}`}
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-3 transition hover:text-cyan"
      >
        <ArrowLeft className="size-4" /> {group ? group.name : "All campaigns"}
      </Link>
      <DashboardHeader
        eyebrow={
          <>
            <StatusPill status={campaign.status} />
            <span>
              {preset.emoji} {preset.label}
            </span>
            {campaign.objective && (
              <>
                <span className="text-fg-3/60">•</span>
                <span>{titleCase(campaign.objective.replace(/^OUTCOME_/, ""))} objective</span>
              </>
            )}
            {account[0] && (
              <>
                <span className="text-fg-3/60">•</span>
                <span>{account[0].name}</span>
              </>
            )}
          </>
        }
        title={<span className="block max-w-3xl">{displayName}</span>}
        subtitle={
          <span>
            {flight} <span className="text-fg-3">· showing {range.label.toLowerCase()}</span>
            {ctx.isPreview && displayName !== campaign.name && <span className="block text-xs text-fg-3">Ads Manager name: {campaign.name}</span>}
          </span>
        }
        range={range}
        platform={platform}
        today={today}
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <div className="col-span-2">
          <KpiCard
            index={0}
            label="Ad spend"
            help={getMetric("spend")!.help}
            icon="wallet"
            accent="cyan"
            value={spend.value}
            format="currency"
            delta={spend.delta}
            better="neutral"
            spark={spend.spark}
            compareLabel={compareLabel}
            size="lg"
            footer={
              share !== null ? (
                <div>
                  <div className="mb-1.5 flex justify-between">
                    <span>Share of your total ad spend</span>
                    <span className="num font-semibold text-fg">{Math.round(share * 100)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-cyan" style={{ width: `${Math.max(2, share * 100)}%` }} />
                  </div>
                </div>
              ) : undefined
            }
          />
        </div>
        {kpis.map((k, i) => (
          <KpiCard
            key={k.key}
            index={i + 1}
            label={k.label}
            help={k.help}
            icon={k.icon}
            accent={k.accent}
            value={k.value}
            format={k.format}
            delta={k.delta}
            better={k.better}
            spark={k.spark}
            compareLabel={compareLabel}
          />
        ))}
      </section>

      <Card className="mt-6 p-5 sm:p-6">
        <SectionTitle eyebrow="Trend" title="Daily performance" className="mb-5" />
        <TrendChart dates={daily.map((d) => d.date)} prevDates={daily.map((_, i) => addDays(range.prevFrom, i))} metrics={trendMetrics} />
      </Card>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-5 sm:p-6">
          <SectionTitle eyebrow="Day by day" title="Daily numbers" className="mb-4" />
          <BreakdownTable
            rows={[...daily].reverse()}
            rowKey={(d) => d.date}
            highlight={(d) => d.date === today}
            first={{
              label: "Day",
              render: (d) => (
                <div>
                  <div className="font-semibold text-fg">{d.date === today ? "Today" : fmtWeekday(d.date)}</div>
                  <div className="text-xs text-fg-3">{fmtDayYear(d.date)}</div>
                </div>
              ),
            }}
            columns={[
              { key: "spend", label: "Spend", format: "currency", get: (d) => d.spend, bar: "var(--color-series-1)" },
              { key: "impr", label: "Impr.", format: "number", get: (d) => d.impressions, hideOnMobile: true },
              { key: "clicks", label: "Clicks", format: "number", get: (d) => d.linkClicks, hideOnMobile: true },
              { key: "result", label: resultMetric.short, format: resultMetric.format, get: (d) => resultMetric.compute(d), strong: true, bar: "var(--color-series-2)" },
              { key: "cost", label: costMetric.short, format: costMetric.format, get: (d) => costMetric.compute(d) },
            ]}
          />
        </Card>
        <Card className="p-5 sm:p-6">
          <SectionTitle eyebrow="Placements" title="Facebook vs. Instagram" className="mb-5" />
          <PlatformSplit rows={platforms} resultMetric={resultMetric} costMetric={costMetric} />
        </Card>
      </section>

      <Card className="mt-6 p-5 sm:p-6">
        <SectionTitle eyebrow="Audiences" title="Ad sets" className="mb-4" />
        <BreakdownTable
          rows={adSetRows}
          rowKey={(r) => r.id}
          first={{
            label: "Ad set",
            render: (r) => (
              <div className="flex items-center gap-2">
                <span className="max-w-[320px] truncate font-semibold text-fg">{r.name}</span>
                <StatusPill status={r.status} />
              </div>
            ),
          }}
          columns={[
            { key: "spend", label: "Spend", format: "currency", get: (r) => r.spend, bar: "var(--color-series-1)" },
            { key: "reach", label: "Reach", format: "number", get: (r) => r.reach, hideOnMobile: true },
            { key: "ctr", label: "CTR", format: "percent", get: (r) => (r.impressions ? r.linkClicks / r.impressions : null), hideOnMobile: true },
            { key: "result", label: resultMetric.short, format: resultMetric.format, get: (r) => resultMetric.compute(r), strong: true, bar: "var(--color-series-2)" },
            { key: "cost", label: costMetric.short, format: costMetric.format, get: (r) => costMetric.compute(r) },
          ]}
        />
      </Card>

      <section className="mt-8">
        <SectionTitle
          eyebrow="Creative"
          title="Ads in this campaign"
          action={<span className="text-xs text-fg-3">{formatMetric(adRows.length, "number")} ads delivered</span>}
          className="mb-4"
        />
        <AdCards ads={adRows} resultMetric={resultMetric} costMetric={costMetric} />
      </section>
    </>
  );
}
