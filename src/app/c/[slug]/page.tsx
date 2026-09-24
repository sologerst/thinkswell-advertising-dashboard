import { ArrowRight, Lightbulb, PlugZap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TrendChart, type TrendMetric } from "@/components/charts/trend-chart";
import { CampaignTable } from "@/components/dashboard/campaign-table";
import { DayCards } from "@/components/dashboard/day-cards";
import { ACCENT_HEX, KpiCard } from "@/components/dashboard/kpi-card";
import { DashboardHeader } from "@/components/dashboard/page-header";
import { PlatformSplit } from "@/components/dashboard/platform-split";
import { MetricIcon } from "@/components/icons";
import { Card, EmptyState, SectionTitle } from "@/components/ui";
import { requireClientAccess } from "@/lib/auth/current";
import { addDays, fmtRange } from "@/lib/dates";
import { formatMetric } from "@/lib/format";
import { getMetric } from "@/lib/metrics/catalog";
import { describeFee } from "@/lib/metrics/fees";
import { loadScope } from "@/lib/metrics/query";
import { buildOverview } from "@/lib/metrics/report";
import { greeting, keepQuery, readDashboardParams } from "@/lib/params";

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { client } = await requireClientAccess(slug);
  return { title: client.name };
}

export default async function OverviewPage({ params, searchParams }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { user, client, isPreview } = await requireClientAccess(slug);
  const { today, range, platform } = readDashboardParams(sp);
  const scope = await loadScope(client);

  const firstName = user.name.split(" ")[0];
  const header = (
    <DashboardHeader
      eyebrow={
        <>
          <span className="text-cyan">{client.name}</span>
          <span className="text-fg-3/60">•</span>
          <span>{range.label}</span>
        </>
      }
      title={isPreview ? `Here's ${client.name}.` : `${greeting()}, ${firstName}.`}
      subtitle={
        <span>
          {fmtRange(range.from, range.to)} <span className="text-fg-3">vs. {fmtRange(range.prevFrom, range.prevTo)}</span>
        </span>
      }
      range={range}
      platform={platform}
      today={today}
    />
  );

  if (scope.accountIds.length === 0) {
    return (
      <>
        {header}
        <Card>
          <EmptyState icon={<PlugZap className="size-10" />} title="Your dashboard is almost ready">
            We&apos;re connecting your ad accounts. Numbers will show up here as soon as the Thinkswell team links them.
          </EmptyState>
        </Card>
      </>
    );
  }

  const r = await buildOverview(client, scope, range, platform);
  const compareLabel = `vs prev. ${range.key === "today" || range.key === "yesterday" ? "day" : "period"}`;
  const q = keepQuery(sp);

  const trendMetrics: TrendMetric[] = [r.spend, ...r.kpis].slice(0, 7).map((k) => {
    const def = getMetric(k.key)!;
    return {
      key: k.key,
      label: def.short,
      format: def.format,
      color: ACCENT_HEX[def.accent],
      better: def.better,
      values: r.series.map((s) => def.compute(s.cur)),
      prev: r.series.map((s) => (s.prev ? def.compute(s.prev) : null)),
    };
  });

  return (
    <>
      {header}

      {client.welcomeNote && (
        <div className="tw-card animate-rise mb-6 flex items-start gap-4 border-gold/25! p-4 sm:p-5">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-gold">
            <Lightbulb className="size-5" />
          </span>
          <div>
            <div className="eyebrow mb-1 text-gold!">A note from your Thinkswell team</div>
            <p className="text-[0.95rem] text-fg">{client.welcomeNote}</p>
          </div>
        </div>
      )}

      {/* Money first: actual ad spend, then the agency fee, then goal KPIs. */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          index={0}
          label="Ad spend"
          help={getMetric("spend")!.help}
          icon="wallet"
          accent="cyan"
          value={r.spend.value}
          format="currency"
          delta={r.spend.delta}
          better="neutral"
          spark={r.spend.spark}
          compareLabel={compareLabel}
          size="lg"
          footer={
            <span className="flex justify-between">
              <span>Paid to Meta</span>
              <span className="num text-fg-3">{formatMetric(r.spend.value! / Math.max(1, r.daily.length), "currency")} / day avg</span>
            </span>
          }
        />
        {r.fee && (
          <KpiCard
            index={1}
            label={client.feeLabel}
            help={`Thinkswell's fee for this period: ${describeFee(client)}. Retainers are spread evenly across each day of the month.`}
            icon="fee"
            accent="gold"
            value={r.fee.value}
            format="currency"
            delta={r.fee.delta}
            better="neutral"
            spark={r.fee.spark}
            compareLabel={compareLabel}
            size="lg"
            footer={
              <span className="flex justify-between gap-2">
                <span className="truncate">{describeFee(client)}</span>
                <span className="num shrink-0 font-semibold text-fg">{formatMetric(r.fee.total, "currency")} total</span>
              </span>
            }
          />
        )}
        {r.kpis.map((k, i) => (
          <KpiCard
            key={k.key}
            index={i + 2}
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

      {r.highlights.length > 0 && (
        <section className="mt-6 grid gap-3 md:grid-cols-3">
          {r.highlights.map((h, i) => {
            const inner = (
              <>
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet/15 text-violet">
                  <MetricIcon name={h.icon} className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-fg">{h.title}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-fg-2">{h.body}</div>
                </div>
                {h.href && <ArrowRight className="ml-auto size-4 shrink-0 self-center text-fg-3 transition group-hover:translate-x-0.5 group-hover:text-cyan" />}
              </>
            );
            const cls = "tw-card group animate-rise flex items-start gap-3 p-4 transition hover:border-line-strong";
            return h.href ? (
              <Link key={h.title} href={`${h.href}${q}`} className={cls} style={{ animationDelay: `${300 + i * 60}ms` }}>
                {inner}
              </Link>
            ) : (
              <div key={h.title} className={cls} style={{ animationDelay: `${300 + i * 60}ms` }}>
                {inner}
              </div>
            );
          })}
        </section>
      )}

      <Card className="mt-6 p-5 sm:p-6">
        <SectionTitle eyebrow="Trend" title="Daily performance" className="mb-5" />
        <TrendChart dates={r.series.map((s) => s.date)} prevDates={r.series.map((_, i) => addDays(range.prevFrom, i))} metrics={trendMetrics} />
      </Card>

      <section className="mt-8">
        <SectionTitle
          eyebrow="Day by day"
          title="Every day at a glance"
          action={<span className="text-xs text-fg-3">Tap a day to zoom in</span>}
          className="mb-4"
        />
        <DayCards
          days={r.daily.map((d) => ({ date: d.date, spend: d.spend, result: r.resultMetric.compute(d), cost: r.costMetric.compute(d) }))}
          resultMetric={r.resultMetric}
          costMetric={r.costMetric}
          today={today}
          hrefFor={(date) => `/c/${slug}${keepQuery(sp, { range: "custom", from: date, to: date })}`}
        />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-5 sm:p-6">
          <SectionTitle
            eyebrow="Campaigns"
            title="What's running"
            action={
              <Link href={`/c/${slug}/campaigns${q}`} className="inline-flex items-center gap-1 text-sm font-semibold text-cyan hover:underline">
                All campaigns <ArrowRight className="size-4" />
              </Link>
            }
            className="mb-4"
          />
          <CampaignTable
            limit={6}
            rows={r.campaigns.map((c) => ({
              id: c.id,
              name: c.name,
              status: c.status,
              objective: c.objective,
              spend: c.spend,
              result: r.resultMetric.compute(c),
              cost: r.costMetric.compute(c),
              ctr: c.impressions ? c.linkClicks / c.impressions : null,
              secondary: null,
              spark: c.spark,
              href: `/c/${slug}/campaigns/${encodeURIComponent(c.id)}${q}`,
            }))}
            resultLabel={r.resultMetric.short}
            resultFormat={r.resultMetric.format}
            costLabel={r.costMetric.short}
          />
        </Card>
        <Card className="p-5 sm:p-6">
          <SectionTitle eyebrow="Placements" title="Facebook vs. Instagram" className="mb-5" />
          <PlatformSplit rows={r.platforms} resultMetric={r.resultMetric} costMetric={r.costMetric} />
        </Card>
      </section>
    </>
  );
}
