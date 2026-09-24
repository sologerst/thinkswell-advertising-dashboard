import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schemaTypes from "@/lib/db/schema";
import { adAccounts, adSets, ads, campaigns, insights, syncRuns } from "@/lib/db/schema";
import { fetchFacebook, listFacebookAccounts, normalizeAccountId } from "@/lib/windsor/client";

type Db = PgDatabase<PgQueryResultHKT, typeof schemaTypes>;

/**
 * Windsor field IDs (verified against https://connectors.windsor.ai/facebook/fields).
 *
 * Meta won't combine the `publisher_platform` breakdown with `omni_*` fields, so
 * metrics use the non-omni action types (`actions_purchase` etc.).
 */
export const METRIC_FIELDS = {
  spend: "spend",
  impressions: "impressions",
  reach: "reach",
  clicks: "clicks",
  linkClicks: "link_clicks",
  landingPageViews: "actions_landing_page_view",
  purchases: "actions_purchase",
  purchaseValue: "action_values_purchase",
  addToCart: "actions_add_to_cart",
  initiateCheckout: "actions_initiate_checkout",
  leads: "actions_lead",
  videoViews: "actions_video_view",
  thruplays: "video_thruplay_watched_actions_video_view",
  postEngagement: "actions_post_engagement",
} as const;

const DIMENSION_FIELDS = [
  "date",
  "account_id",
  "account_name",
  "campaign_id",
  "campaign",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "publisher_platform",
];

// Second, breakdown-free request for statuses, objectives and creative thumbnails.
const META_FIELDS = [
  "account_id",
  "campaign_id",
  "campaign",
  "campaign_effective_status",
  "campaign_objective",
  "adset_id",
  "adset_name",
  "adset_effective_status",
  "ad_id",
  "ad_name",
  "effective_status",
  "thumbnail_url",
];

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

export type SyncResult = { runId: string; rows: number; accounts: number; warnings: string[] };

export async function syncWindsor(db: Db, opts: { from: string; to: string; triggeredBy: string; accountIds?: string[] }): Promise<SyncResult> {
  const [run] = await db
    .insert(syncRuns)
    .values({ source: "windsor", dateFrom: opts.from, dateTo: opts.to, triggeredBy: opts.triggeredBy })
    .returning({ id: syncRuns.id });
  const warnings: string[] = [];

  try {
    // 1. Discover connected ad accounts and keep their names fresh.
    const listed = await listFacebookAccounts();
    if (listed.length === 0) {
      throw new Error("Windsor returned no Facebook accounts. Check the API key and that Meta is connected in Windsor.");
    }
    for (const a of listed) {
      await db
        .insert(adAccounts)
        .values({ id: a.id, name: a.name, source: "windsor" })
        .onConflictDoUpdate({ target: adAccounts.id, set: { name: a.name, source: "windsor" } });
    }
    const targets = opts.accountIds?.length ? listed.filter((a) => opts.accountIds!.includes(a.id)) : listed;

    let total = 0;
    // 2. Pull each account separately so one bad account doesn't sink the run.
    for (const account of targets) {
      try {
        total += await syncAccount(db, account.id, opts.from, opts.to, warnings);
        await db.update(adAccounts).set({ lastSyncedAt: new Date() }).where(eq(adAccounts.id, account.id));
      } catch (e) {
        warnings.push(`${account.name}: ${(e as Error).message}`);
      }
    }

    if (warnings.length && total === 0) throw new Error(warnings.join(" | "));

    await db
      .update(syncRuns)
      .set({ status: "success", rows: total, finishedAt: new Date(), error: warnings.length ? warnings.join(" | ") : null })
      .where(eq(syncRuns.id, run!.id));
    return { runId: run!.id, rows: total, accounts: targets.length, warnings };
  } catch (e) {
    await db
      .update(syncRuns)
      .set({ status: "error", error: (e as Error).message, finishedAt: new Date() })
      .where(eq(syncRuns.id, run!.id));
    throw e;
  }
}

async function syncAccount(db: Db, accountId: string, from: string, to: string, warnings: string[]) {
  const rows = await fetchFacebook({
    fields: [...DIMENSION_FIELDS, ...Object.values(METRIC_FIELDS)],
    from,
    to,
    accounts: [accountId],
  });

  // Merge any duplicate grain rows defensively.
  type Fact = typeof insights.$inferInsert;
  const facts = new Map<string, Fact>();
  const camps = new Map<string, { id: string; name: string }>();
  const sets = new Map<string, { id: string; name: string; campaignId: string }>();
  const adMap = new Map<string, { id: string; name: string; adSetId: string; campaignId: string }>();

  for (const r of rows) {
    const date = str(r.date);
    const campaignId = str(r.campaign_id);
    const adSetId = str(r.adset_id) ?? `${campaignId}-adset`;
    const adId = str(r.ad_id) ?? `${adSetId}-ad`;
    if (!date || !campaignId) continue;
    const platform = (str(r.publisher_platform) ?? "unknown").toLowerCase();

    camps.set(campaignId, { id: campaignId, name: str(r.campaign) ?? campaignId });
    sets.set(adSetId, { id: adSetId, name: str(r.adset_name) ?? adSetId, campaignId });
    adMap.set(adId, { id: adId, name: str(r.ad_name) ?? adId, adSetId, campaignId });

    const key = `${date}|${adId}|${platform}`;
    const f: Fact = facts.get(key) ?? { date, accountId, campaignId, adSetId, adId, platform };
    for (const [col, field] of Object.entries(METRIC_FIELDS)) {
      const c = col as keyof typeof METRIC_FIELDS;
      (f as Record<string, unknown>)[c] = num((f as Record<string, unknown>)[c]) + num(r[field]);
    }
    facts.set(key, f);
  }

  // Statuses / objectives / thumbnails. Optional: a failure here only warns.
  const meta = new Map<string, Record<string, unknown>>();
  try {
    const metaRows = await fetchFacebook({ fields: META_FIELDS, from, to, accounts: [accountId] });
    for (const m of metaRows) {
      const adId = str(m.ad_id);
      if (adId) meta.set(adId, m);
      const cid = str(m.campaign_id);
      if (cid && !meta.has(`c:${cid}`)) meta.set(`c:${cid}`, m);
      const sid = str(m.adset_id);
      if (sid && !meta.has(`s:${sid}`)) meta.set(`s:${sid}`, m);
    }
  } catch (e) {
    warnings.push(`Metadata for account ${accountId}: ${(e as Error).message}`);
  }

  const campaignRows = [...camps.values()].map((c) => {
    const m = meta.get(`c:${c.id}`);
    return {
      id: c.id,
      accountId,
      name: c.name,
      status: str(m?.campaign_effective_status),
      objective: str(m?.campaign_objective),
      updatedAt: new Date(),
    };
  });
  const adSetRows = [...sets.values()].map((s) => ({
    id: s.id,
    campaignId: s.campaignId,
    accountId,
    name: s.name,
    status: str(meta.get(`s:${s.id}`)?.adset_effective_status),
  }));
  const adRows = [...adMap.values()].map((a) => {
    const m = meta.get(a.id);
    return { ...a, accountId, status: str(m?.effective_status), thumbnailUrl: str(m?.thumbnail_url) };
  });
  const factRows = [...facts.values()];

  await db.transaction(async (tx) => {
    for (const chunk of chunks(campaignRows)) {
      await tx
        .insert(campaigns)
        .values(chunk)
        .onConflictDoUpdate({
          target: campaigns.id,
          set: {
            name: sql`excluded.name`,
            accountId: sql`excluded.account_id`,
            updatedAt: sql`excluded.updated_at`,
            status: sql`coalesce(excluded.status, ${campaigns.status})`,
            objective: sql`coalesce(excluded.objective, ${campaigns.objective})`,
          },
        });
    }
    for (const chunk of chunks(adSetRows)) {
      await tx
        .insert(adSets)
        .values(chunk)
        .onConflictDoUpdate({
          target: adSets.id,
          set: {
            name: sql`excluded.name`,
            campaignId: sql`excluded.campaign_id`,
            status: sql`coalesce(excluded.status, ${adSets.status})`,
          },
        });
    }
    for (const chunk of chunks(adRows)) {
      await tx
        .insert(ads)
        .values(chunk)
        .onConflictDoUpdate({
          target: ads.id,
          set: {
            name: sql`excluded.name`,
            adSetId: sql`excluded.ad_set_id`,
            campaignId: sql`excluded.campaign_id`,
            status: sql`coalesce(excluded.status, ${ads.status})`,
            thumbnailUrl: sql`coalesce(excluded.thumbnail_url, ${ads.thumbnailUrl})`,
          },
        });
    }

    // Replace the window so late-arriving conversions and deleted rows are reflected.
    await tx.delete(insights).where(and(eq(insights.accountId, accountId), gte(insights.date, from), lte(insights.date, to)));
    for (const chunk of chunks(factRows)) await tx.insert(insights).values(chunk);
  });

  return facts.size;
}

export function chunks<T>(arr: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function knownAccountIds(db: Db) {
  const rows = await db.select({ id: adAccounts.id }).from(adAccounts);
  return rows.map((r) => r.id);
}

export async function removeAccountsData(db: Db, accountIds: string[]) {
  if (!accountIds.length) return;
  await db.delete(insights).where(inArray(insights.accountId, accountIds.map(normalizeAccountId)));
}

export async function countInsights(db: Db) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(insights);
  return r?.n ?? 0;
}
