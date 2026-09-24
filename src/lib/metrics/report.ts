import "server-only";
import { inArray, max } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { adAccounts, type Client } from "@/lib/db/schema";
import type { DateRange, ISODate } from "@/lib/dates";
import { pctChange } from "@/lib/format";
import { GOAL_PRESETS, getMetric, type MetricDef, type Totals } from "./catalog";
import { feeForDay, feeForDays, hasFee } from "./fees";
import { getByCampaign, getByPlatform, getCampaignDaily, getDaily, sumRows, type DailyRow, type Filters, type Scope } from "./query";

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

/** KPI keys to show for a client: its saved list, or its goal preset. */
export function clientKpis(client: Pick<Client, "kpis" | "goal">): MetricDef[] {
  const keys = client.kpis?.length ? client.kpis : GOAL_PRESETS[client.goal].kpis;
  return keys.map((k) => getMetric(k)).filter((m): m is MetricDef => Boolean(m) && m!.key !== "spend");
}

export async function lastSyncedAt(scope: Scope): Promise<Date | null> {
  if (!scope.accountIds.length) return null;
  const db = await getDb();
  const [r] = await db.select({ t: max(adAccounts.lastSyncedAt) }).from(adAccounts).where(inArray(adAccounts.id, scope.accountIds));
  return r?.t ? new Date(r.t) : null;
}

export type Highlight = { icon: string; title: string; body: string; href?: string };

export async function buildOverview(client: Client, scope: Scope, range: DateRange, platform: string | null) {
  const preset = GOAL_PRESETS[client.goal];
  const f: Filters = { from: range.from, to: range.to, platform };
  const pf: Filters = { from: range.prevFrom, to: range.prevTo, platform };

  const resultMetric = getMetric(preset.result)!;
  const costMetric = getMetric(preset.costPerResult)!;
  const resultField = resultFieldFor(preset.result);

  const [daily, prevDaily, campaigns, platforms, campaignSparks, synced] = await Promise.all([
    getDaily(scope, f),
    getDaily(scope, pf),
    getByCampaign(scope, f),
    getByPlatform(scope, { from: range.from, to: range.to }),
    getCampaignDaily(scope, f, resultField),
    lastSyncedAt(scope),
  ]);

  const cur = sumRows(daily);
  const prev = sumRows(prevDaily);

  const spend = kpiFor(getMetric("spend")!, cur, prev, daily);
  const kpis = clientKpis(client).map((m) => kpiFor(m, cur, prev, daily));

  let fee: null | { value: number; prev: number; delta: number | null; spark: number[]; total: number } = null;
  if (hasFee(client)) {
    const value = feeForDays(client, daily);
    const p = feeForDays(client, prevDaily);
    fee = {
      value,
      prev: p,
      delta: pctChange(value, p),
      spark: daily.map((d) => feeForDay(client, d.date, d.spend)),
      total: value + cur.spend,
    };
  }

  // Previous-period values aligned by position, for the trend chart's ghost line.
  const series = daily.map((d, i) => ({ date: d.date, cur: d, prev: prevDaily[i] ?? null }));

  const highlights = buildHighlights({ daily, campaigns, platforms, resultMetric, costMetric, slug: client.slug });

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
    campaigns: campaigns.map((c) => ({ ...c, spark: campaignSparks.get(c.id) ?? [] })),
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
  if (top && totalResults > 0) {
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
