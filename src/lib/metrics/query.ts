import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lte, max, notInArray, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { adSets, ads, campaigns, clientAccounts, clientCampaigns, insights, type Client } from "@/lib/db/schema";
import { eachDay, type ISODate } from "@/lib/dates";
import { BASE_FIELDS, emptyTotals, type BaseField, type Totals } from "./catalog";

/**
 * Everything a client is allowed to see: their ad accounts, optionally narrowed
 * by an include/exclude campaign list and a campaign-name filter. Every query in
 * this file goes through `scopeWhere` so data can't leak between clients.
 */
export type Scope = {
  accountIds: string[];
  campaignMode: Client["campaignMode"];
  campaignIds: string[];
  nameFilter: string | null;
  /** Extra allow-list (a campaign group, or a person's permitted groups). null = no extra limit. */
  restrictTo: string[] | null;
};

export async function loadScope(client: Pick<Client, "id" | "campaignMode" | "campaignNameFilter">): Promise<Scope> {
  const db = await getDb();
  const [accts, camps] = await Promise.all([
    db.select({ id: clientAccounts.accountId }).from(clientAccounts).where(eq(clientAccounts.clientId, client.id)),
    db.select({ id: clientCampaigns.campaignId }).from(clientCampaigns).where(eq(clientCampaigns.clientId, client.id)),
  ]);
  return {
    accountIds: accts.map((a) => a.id),
    campaignMode: client.campaignMode,
    campaignIds: camps.map((c) => c.id),
    nameFilter: client.campaignNameFilter?.trim() || null,
    restrictTo: null,
  };
}

/** Narrows a scope to the given campaigns (intersecting any existing restriction). */
export function narrowScope(scope: Scope, campaignIds: string[]): Scope {
  const allowed = scope.restrictTo ? scope.restrictTo.filter((id) => campaignIds.includes(id)) : [...new Set(campaignIds)];
  return { ...scope, restrictTo: allowed };
}

function scopeWhere(scope: Scope): SQL {
  if (scope.accountIds.length === 0) return sql`false`;
  const parts: (SQL | undefined)[] = [inArray(insights.accountId, scope.accountIds)];
  if (scope.campaignMode === "include") {
    if (scope.campaignIds.length === 0) return sql`false`;
    parts.push(inArray(insights.campaignId, scope.campaignIds));
  } else if (scope.campaignMode === "exclude" && scope.campaignIds.length > 0) {
    parts.push(notInArray(insights.campaignId, scope.campaignIds));
  }
  if (scope.restrictTo) {
    if (scope.restrictTo.length === 0) return sql`false`;
    parts.push(inArray(insights.campaignId, scope.restrictTo));
  }
  if (scope.nameFilter) {
    parts.push(
      sql`exists (select 1 from ${campaigns} where ${campaigns.id} = ${insights.campaignId} and ${campaigns.name} ilike ${"%" + escapeLike(scope.nameFilter) + "%"})`,
    );
  }
  return and(...parts)!;
}

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export type Filters = {
  from: ISODate;
  to: ISODate;
  platform?: string | null;
  campaignId?: string | null;
  adSetId?: string | null;
};

function filterWhere(scope: Scope, f: Filters): SQL {
  return and(
    scopeWhere(scope),
    gte(insights.date, f.from),
    lte(insights.date, f.to),
    f.platform ? eq(insights.platform, f.platform) : undefined,
    f.campaignId ? eq(insights.campaignId, f.campaignId) : undefined,
    f.adSetId ? eq(insights.adSetId, f.adSetId) : undefined,
  )!;
}

const sums = Object.fromEntries(
  BASE_FIELDS.map((f) => [f, sql<number>`coalesce(sum(${insights[f]}), 0)::float8`.mapWith(Number)]),
) as Record<BaseField, SQL.Aliased<number> | SQL<number>>;

function pickTotals(row: Record<string, unknown>): Totals {
  const t = emptyTotals();
  for (const f of BASE_FIELDS) t[f] = Number(row[f] ?? 0);
  return t;
}

export type DailyRow = Totals & { date: ISODate };

/** One row per day in the range (zero-filled). */
export async function getDaily(scope: Scope, f: Filters): Promise<DailyRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ date: insights.date, ...sums })
    .from(insights)
    .where(filterWhere(scope, f))
    .groupBy(insights.date)
    .orderBy(asc(insights.date));
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return eachDay(f.from, f.to).map((date) => {
    const r = byDate.get(date);
    return { date, ...(r ? pickTotals(r) : emptyTotals()) };
  });
}

export type CampaignRow = Totals & {
  id: string;
  name: string;
  status: string | null;
  objective: string | null;
  accountId: string;
};

export async function getByCampaign(scope: Scope, f: Filters): Promise<CampaignRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: insights.campaignId,
      accountId: insights.accountId,
      name: sql<string>`coalesce(max(${campaigns.name}), ${insights.campaignId})`,
      status: sql<string | null>`max(${campaigns.status})`,
      objective: sql<string | null>`max(${campaigns.objective})`,
      ...sums,
    })
    .from(insights)
    .leftJoin(campaigns, eq(campaigns.id, insights.campaignId))
    .where(filterWhere(scope, f))
    .groupBy(insights.campaignId, insights.accountId)
    .orderBy(desc(sql`sum(${insights.spend})`));
  return rows.map((r) => ({ id: r.id, accountId: r.accountId, name: r.name, status: r.status, objective: r.objective, ...pickTotals(r) }));
}

/** Per-campaign daily values of one field, for table sparklines. */
export async function getCampaignDaily(scope: Scope, f: Filters, field: BaseField): Promise<Map<string, number[]>> {
  const db = await getDb();
  const rows = await db
    .select({
      campaignId: insights.campaignId,
      date: insights.date,
      v: sql<number>`coalesce(sum(${insights[field]}), 0)::float8`.mapWith(Number),
    })
    .from(insights)
    .where(filterWhere(scope, f))
    .groupBy(insights.campaignId, insights.date);
  const days = eachDay(f.from, f.to);
  const idx = new Map(days.map((d, i) => [d, i]));
  const out = new Map<string, number[]>();
  for (const r of rows) {
    let arr = out.get(r.campaignId);
    if (!arr) out.set(r.campaignId, (arr = new Array(days.length).fill(0)));
    const i = idx.get(r.date);
    if (i !== undefined) arr[i] = r.v;
  }
  return out;
}

export type PlatformRow = Totals & { platform: string };

export async function getByPlatform(scope: Scope, f: Filters): Promise<PlatformRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ platform: insights.platform, ...sums })
    .from(insights)
    .where(filterWhere(scope, { ...f, platform: null }))
    .groupBy(insights.platform)
    .orderBy(desc(sql`sum(${insights.spend})`));
  return rows.map((r) => ({ platform: r.platform, ...pickTotals(r) }));
}

export type AdSetRow = Totals & { id: string; name: string; status: string | null };

export async function getByAdSet(scope: Scope, f: Filters): Promise<AdSetRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: insights.adSetId,
      name: sql<string>`coalesce(max(${adSets.name}), ${insights.adSetId})`,
      status: sql<string | null>`max(${adSets.status})`,
      ...sums,
    })
    .from(insights)
    .leftJoin(adSets, eq(adSets.id, insights.adSetId))
    .where(filterWhere(scope, f))
    .groupBy(insights.adSetId)
    .orderBy(desc(sql`sum(${insights.spend})`));
  return rows.map((r) => ({ id: r.id, name: r.name, status: r.status, ...pickTotals(r) }));
}

export type AdRow = Totals & {
  id: string;
  name: string;
  status: string | null;
  thumbnailUrl: string | null;
  title: string | null;
  body: string | null;
  adSetName: string | null;
};

export async function getByAd(scope: Scope, f: Filters): Promise<AdRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: insights.adId,
      name: sql<string>`coalesce(max(${ads.name}), ${insights.adId})`,
      status: sql<string | null>`max(${ads.status})`,
      thumbnailUrl: sql<string | null>`max(${ads.thumbnailUrl})`,
      title: sql<string | null>`max(${ads.title})`,
      body: sql<string | null>`max(${ads.body})`,
      adSetName: sql<string | null>`max(${adSets.name})`,
      ...sums,
    })
    .from(insights)
    .leftJoin(ads, eq(ads.id, insights.adId))
    .leftJoin(adSets, eq(adSets.id, insights.adSetId))
    .where(filterWhere(scope, f))
    .groupBy(insights.adId)
    .orderBy(desc(sql`sum(${insights.spend})`));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    thumbnailUrl: r.thumbnailUrl,
    title: r.title,
    body: r.body,
    adSetName: r.adSetName,
    ...pickTotals(r),
  }));
}

/** Campaign metadata, only if the campaign is visible to this scope. */
export async function getCampaignInScope(scope: Scope, campaignId: string) {
  const db = await getDb();
  const [hit] = await db
    .select({ id: insights.campaignId, first: sql<string>`min(${insights.date})`, last: sql<string>`max(${insights.date})` })
    .from(insights)
    .where(and(scopeWhere(scope), eq(insights.campaignId, campaignId)))
    .groupBy(insights.campaignId);
  if (!hit) return null;
  const [meta] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  return {
    id: campaignId,
    name: meta?.name ?? campaignId,
    status: meta?.status ?? null,
    objective: meta?.objective ?? null,
    accountId: meta?.accountId ?? null,
    firstDate: hit.first as ISODate,
    lastDate: hit.last as ISODate,
  };
}

export async function getLatestDate(scope: Scope): Promise<ISODate | null> {
  const db = await getDb();
  const [r] = await db.select({ d: max(insights.date) }).from(insights).where(scopeWhere(scope));
  return (r?.d as ISODate | null) ?? null;
}

/** Campaigns available to pick from when configuring a client (admin). */
export async function listCampaignsForAccounts(accountIds: string[]) {
  if (accountIds.length === 0) return [];
  const db = await getDb();
  return db
    .select({ id: campaigns.id, name: campaigns.name, status: campaigns.status, accountId: campaigns.accountId })
    .from(campaigns)
    .where(inArray(campaigns.accountId, accountIds))
    .orderBy(asc(campaigns.name));
}

export async function searchCampaignNames(accountIds: string[], q: string) {
  if (accountIds.length === 0) return [];
  const db = await getDb();
  return db
    .select({ id: campaigns.id, name: campaigns.name })
    .from(campaigns)
    .where(and(inArray(campaigns.accountId, accountIds), ilike(campaigns.name, `%${escapeLike(q)}%`)));
}

export function sumRows(rows: Totals[]): Totals {
  const t = emptyTotals();
  for (const r of rows) for (const f of BASE_FIELDS) t[f] += r[f];
  return t;
}
