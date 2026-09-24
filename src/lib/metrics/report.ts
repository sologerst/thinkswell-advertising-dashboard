import "server-only";
import { inArray, max } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { adAccounts, type GoalType } from "@/lib/db/schema";
import type { DateRange, ISODate } from "@/lib/dates";
import { pctChange } from "@/lib/format";
import { GOAL_PRESETS, getMetric, type MetricDef, type Totals } from "./catalog";
import { feeForDay, feeForDays, hasFee, type FeeConfig } from "./fees";
import { getByCampaign, getByPlatform, getCampaignDaily, getDaily, sumRows, type CampaignRow, type DailyRow, type Filters, type Scope } from "./query";

export type KpiValue = {
  key: string;
  label: string;
  help: string;
  format: MetricDef["format"];
  better: MetricDef["better"];
  accent: MetricDef["accent"];
  icon: string;
  value: number | null;
  prev: number | null;
  delta: number | null;
  spark: (number | null)[];
};

export function kpiFor(def: MetricDef, cur: Totals, prev: Totals, daily: DailyRow[]): KpiValue {
  const value = def.compute(cur);
  const p = def.compute(prev);
  return {
    key: def.key,
    label: def.label,
    help: def.help,
    format: def.format,
    better: def.better,
    accent: def.accent,
    icon: def.icon,
    value,
    prev: p,
    delta: pctChange(value, p),
    spark: daily.map((d) => def.compute(d)),
  };
}

/** KPI cards for a view: its saved list, or its goal preset. Spend is always shown separately. */
export function clientKpis(setup: { kpis: string[]; goal: GoalType }): MetricDef[] {
  const keys = setup.kpis?.length ? setup.kpis : GOAL_PRESETS[setup.goal].kpis;
  return keys.map((k) => getMetric(k)).filter((m): m is MetricDef => Boolean(m) && m!.key !== "spend");
}

export async function lastSyncedAt(scope: Scope): Promise<Date | null> {
  if (!scope.accountIds.length) return null;
  const db = await getDb();
  const [r] = await db.select({ t: max(adAccounts.lastSyncedAt) }).from(adAccounts).where(inArray(adAccounts.id, scope.accountIds));
  return r?.t ? new Date(r.t) : null;
}

export type Highlight = { icon: string; title: string; body: string; href?: string };

/** How campaign rows get their friendly name and goal (see lib/client-context.ts). */
export type CampaignLabels = {
  nameFor: (campaignId: string, fallback: string) => string;
  goalFor: (campaignId: string) => GoalType;
  groupFor?: (campaignId: string) => { id: string; name: string } | null;
};

export type CampaignView = CampaignRow & {
  originalName: string;
  goal: GoalType;
  groupId: string | null;
  result: number | null;
  cost: number | null;
  resultUnit: string;
  costUnit: string;
  spark: number[];
};

/**
 * Campaign rows with display names, their own goal's result and cost, and a
 * result-trend sparkline, so tables can mix ticket, lead and video campaigns.
 */
export async function campaignViews(scope: Scope, f: Filters, labels: CampaignLabels): Promise<CampaignView[]> {
  const rows = await getByCampaign(scope, f);
  const goals = new Map(rows.map((r) => [r.id, labels.goalFor(r.id)]));
  const fields = [...new Set([...goals.values()].map((g) => resultFieldFor(GOAL_PRESETS[g].result)))];
  const sparksByField = new Map(await Promise.all(fields.map(async (field) => [field, await getCampaignDaily(scope, f, field)] as const)));
  return rows.map((r) => {
    const goal = goals.get(r.id)!;
    const preset = GOAL_PRESETS[goal];
    const field = resultFieldFor(preset.result);
    return {
      ...r,
      originalName: r.name,
      name: labels.nameFor(r.id, r.name),
      goal,
      groupId: labels.groupFor?.(r.id)?.id ?? null,
      result: getMetric(preset.result)!.compute(r),
      cost: getMetric(preset.costPerResult)!.compute(r),
      resultUnit: preset.unit,
      costUnit: preset.unitOne,
      spark: sparksByField.get(field)?.get(r.id) ?? [],
    };
  });
}

export async function buildOverview(opts: {
  slug: string;
  setup: { goal: GoalType; kpis: string[] };
  fee: FeeConfig | null;
  scope: Scope;
  range: DateRange;
  platform: string | null;
  labels: CampaignLabels;
}) {
  const { setup, scope, range, platform } = opts;
  const preset = GOAL_PRESETS[setup.goal];
  const f: Filters = { from: range.from, to: range.to, platform };
  const pf: Filters = { from: range.prevFrom, to: range.prevTo, platform };

  const resultMetric = getMetric(preset.result)!;
  const costMetric = getMetric(preset.costPerResult)!;

  const [daily, prevDaily, campaigns, platforms, synced] = await Promise.all([
    getDaily(scope, f),
    getDaily(scope, pf),
    campaignViews(scope, f, opts.labels),
    getByPlatform(scope, { from: range.from, to: range.to }),
    lastSyncedAt(scope),
  ]);

  const cur = sumRows(daily);
  const prev = sumRows(prevDaily);

  const spend = kpiFor(getMetric("spend")!, cur, prev, daily);
  const kpis = clientKpis(setup).map((m) => kpiFor(m, cur, prev, daily));

  let fee: null | { value: number; prev: number; delta: number | null; spark: number[]; total: number; config: FeeConfig } = null;
  if (opts.fee && hasFee(opts.fee)) {
    const cfg = opts.fee;
    const value = feeForDays(cfg, daily);
    const p = feeForDays(cfg, prevDaily);
    fee = {
      value,
      prev: p,
      delta: pctChange(value, p),
      spark: daily.map((d) => feeForDay(cfg, d.date, d.spend)),
      total: value + cur.spend,
      config: cfg,
    };
  }

  // Previous-period values aligned by position, for the trend chart's ghost line.
  const series = daily.map((d, i) => ({ date: d.date, cur: d, prev: prevDaily[i] ?? null }));

  const highlights = buildHighlights({ daily, campaigns, platforms, resultMetric, costMetric, slug: opts.slug });

  return {
    preset,
    resultMetric,
    costMetric,
    totals: cur,
    prevTotals: prev,
    spend,
    fee,
    kpis,
    daily,
    series,
    campaigns,
    mixedGoals: new Set(campaigns.map((c) => c.goal)).size > 1,
    platforms,
    highlights,
    synced,
  };
}

export function resultFieldFor(metricKey: string): keyof Totals {
  const map: Record<string, keyof Totals> = {
    purchases: "purchases",
    leads: "leads",
    thruplays: "thruplays",
    linkClicks: "linkClicks",
    reach: "reach",
    landingPageViews: "landingPageViews",
  };
  return map[metricKey] ?? "spend";
}

function buildHighlights(args: {
  daily: DailyRow[];
  campaigns: (Totals & { id: string; name: string })[];
  platforms: (Totals & { platform: string })[];
  resultMetric: MetricDef;
  costMetric: MetricDef;
  slug: string;
}): Highlight[] {
  const { daily, campaigns, platforms, resultMetric, costMetric } = args;
  const out: Highlight[] = [];
  const fmtN = (n: number) => Math.round(n).toLocaleString("en-US");

  const withResults = daily.filter((d) => (resultMetric.compute(d) ?? 0) > 0);
  if (withResults.length > 1) {
    const best = withResults.reduce((a, b) => ((resultMetric.compute(b) ?? 0) > (resultMetric.compute(a) ?? 0) ? b : a));
    const cpr = costMetric.compute(best);
    out.push({
      icon: "trophy",
      title: `Best day: ${weekdayDate(best.date)}`,
      body: `${fmtN(resultMetric.compute(best) ?? 0)} ${resultMetric.label.toLowerCase()}${cpr ? ` at $${cpr.toFixed(2)} each` : ""}.`,
    });
  }

  const totalResults = campaigns.reduce((s, c) => s + (resultMetric.compute(c) ?? 0), 0);
  const top = [...campaigns].sort((a, b) => (resultMetric.compute(b) ?? 0) - (resultMetric.compute(a) ?? 0))[0];
  const withResult = campaigns.filter((c) => (resultMetric.compute(c) ?? 0) > 0).length;
  if (top && totalResults > 0 && withResult > 1) {
    const share = (resultMetric.compute(top) ?? 0) / totalResults;
    out.push({
      icon: "flame",
      title: "Top campaign",
      body: `${top.name} drove ${Math.round(share * 100)}% of ${resultMetric.label.toLowerCase()}.`,
      href: `/c/${args.slug}/campaigns/${encodeURIComponent(top.id)}`,
    });
  }

  const fb = platforms.find((p) => p.platform === "facebook");
  const ig = platforms.find((p) => p.platform === "instagram");
  if (fb && ig) {
    const cf = costMetric.compute(fb);
    const ci = costMetric.compute(ig);
    if (cf && ci) {
      const diff = Math.abs(cf - ci) / Math.max(cf, ci);
      const per = costMetric.label.toLowerCase().replace(/^cost per /, "per ");
      if (diff < 0.05) {
        out.push({
          icon: "sparkles",
          title: "Neck and neck",
          body: `Facebook and Instagram are within ${Math.max(1, Math.round(diff * 100))}% on cost ${per}. Both are pulling their weight.`,
        });
      } else {
        const winner = ci < cf ? "Instagram" : "Facebook";
        out.push({
          icon: winner === "Instagram" ? "instagram" : "facebook",
          title: `${winner} is winning`,
          body: `${Math.round(diff * 100)}% cheaper ${per} than ${winner === "Instagram" ? "Facebook" : "Instagram"}.`,
        });
      }
    }
  }
  return out;
}

function weekdayDate(d: ISODate) {
  const dt = new Date(`${d}T00:00:00Z`);
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
