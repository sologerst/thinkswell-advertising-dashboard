import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schemaTypes from "@/lib/db/schema";
import { adAccounts, adSets, ads, campaigns, insights, syncRuns } from "@/lib/db/schema";
import { APP_TIMEZONE, todayISO, type ISODate } from "@/lib/dates";
import { DEMO_ACCOUNTS, generateDemo } from "@/lib/demo/generate";
import { chunks } from "./windsor-sync";

type Db = PgDatabase<PgQueryResultHKT, typeof schemaTypes>;

function fractionOfDayElapsed() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIMEZONE, hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 12) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return Math.max(0.05, (h * 60 + m) / 1440);
}

/** Writes demo accounts/campaigns/ads and regenerates insights for [from, to]. */
export async function syncDemo(db: Db, opts: { from: ISODate; to: ISODate; triggeredBy: string }) {
  const today = todayISO();
  const to = opts.to > today ? today : opts.to;
  const [run] = await db
    .insert(syncRuns)
    .values({ source: "demo", dateFrom: opts.from, dateTo: to, triggeredBy: opts.triggeredBy })
    .returning({ id: syncRuns.id });

  const data = generateDemo({ from: opts.from, to, today, todayFraction: fractionOfDayElapsed() });
  const accountIds = DEMO_ACCOUNTS.map((a) => a.id);

  await db.transaction(async (tx) => {
    await tx
      .insert(adAccounts)
      .values(data.accounts.map((a) => ({ ...a, lastSyncedAt: new Date() })))
      .onConflictDoUpdate({ target: adAccounts.id, set: { name: sql`excluded.name`, lastSyncedAt: sql`excluded.last_synced_at` } });
    await tx
      .insert(campaigns)
      .values(data.campaigns)
      .onConflictDoUpdate({
        target: campaigns.id,
        set: { name: sql`excluded.name`, status: sql`excluded.status`, objective: sql`excluded.objective`, startDate: sql`excluded.start_date`, endDate: sql`excluded.end_date` },
      });
    await tx
      .insert(adSets)
      .values(data.adSets)
      .onConflictDoUpdate({ target: adSets.id, set: { name: sql`excluded.name`, status: sql`excluded.status` } });
    await tx
      .insert(ads)
      .values(data.ads)
      .onConflictDoUpdate({
        target: ads.id,
        set: { name: sql`excluded.name`, status: sql`excluded.status`, title: sql`excluded.title`, body: sql`excluded.body` },
      });
    await tx.delete(insights).where(and(inArray(insights.accountId, accountIds), gte(insights.date, opts.from), lte(insights.date, to)));
    for (const chunk of chunks(data.rows, 1000)) {
      await tx.insert(insights).values(chunk as (typeof insights.$inferInsert)[]);
    }
  });

  await db.update(syncRuns).set({ status: "success", rows: data.rows.length, finishedAt: new Date() }).where(eq(syncRuns.id, run!.id));
  return { rows: data.rows.length };
}
