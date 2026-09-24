import "server-only";
import { and, asc, count, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { adAccounts, campaignGroups, campaignSettings, clientAccounts, clientMembers, clients, insights, memberGroups, syncRuns, users } from "@/lib/db/schema";
import { addDays, todayISO } from "@/lib/dates";
import { GOAL_PRESETS, getMetric } from "@/lib/metrics/catalog";
import { feeForDays, hasFee } from "@/lib/metrics/fees";
import { getDaily, loadScope, sumRows } from "@/lib/metrics/query";

/** Last-7-day snapshot per client for the admin home. */
export async function clientSnapshots() {
  const db = await getDb();
  const list = await db.select().from(clients).where(isNull(clients.archivedAt)).orderBy(asc(clients.name));
  const today = todayISO();
  const to = addDays(today, -1);
  const from = addDays(to, -6);

  const memberCounts = await db.select({ clientId: clientMembers.clientId, n: count() }).from(clientMembers).groupBy(clientMembers.clientId);
  const mc = new Map(memberCounts.map((m) => [m.clientId, m.n]));

  return Promise.all(
    list.map(async (c) => {
      const scope = await loadScope(c);
      const daily = await getDaily(scope, { from, to });
      const t = sumRows(daily);
      const preset = GOAL_PRESETS[c.goal];
      const result = getMetric(preset.result)!;
      const cost = getMetric(preset.costPerResult)!;
      return {
        client: c,
        accounts: scope.accountIds.length,
        members: mc.get(c.id) ?? 0,
        spend: t.spend,
        fee: hasFee(c) ? feeForDays(c, daily) : null,
        result: result.compute(t),
        resultLabel: result.label,
        resultFormat: result.format,
        cost: cost.compute(t),
        costLabel: cost.short,
        spark: daily.map((d) => d.spend),
      };
    }),
  );
}

export async function accountsWithUsage() {
  const db = await getDb();
  const [accts, links] = await Promise.all([
    db.select().from(adAccounts).orderBy(asc(adAccounts.name)),
    db
      .select({ accountId: clientAccounts.accountId, clientName: clients.name })
      .from(clientAccounts)
      .innerJoin(clients, eq(clients.id, clientAccounts.clientId))
      .where(isNull(clients.archivedAt)),
  ]);
  return accts.map((a) => ({ ...a, usedBy: links.filter((l) => l.accountId === a.id).map((l) => l.clientName) }));
}

export async function accountSpend(days = 30) {
  const db = await getDb();
  const to = todayISO();
  const from = addDays(to, -(days - 1));
  const rows = await db
    .select({ accountId: insights.accountId, spend: sql<number>`coalesce(sum(${insights.spend}),0)::float8`.mapWith(Number), last: sql<string>`max(${insights.date})` })
    .from(insights)
    .where(and(gte(insights.date, from), lte(insights.date, to)))
    .groupBy(insights.accountId);
  return new Map(rows.map((r) => [r.accountId, r]));
}

export async function recentSyncRuns(limit = 12) {
  const db = await getDb();
  return db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(limit);
}

export async function membersOf(clientId: string) {
  const db = await getDb();
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      lastLoginAt: users.lastLoginAt,
      hasPassword: sql<boolean>`${users.passwordHash} is not null`,
      restricted: clientMembers.restricted,
    })
    .from(clientMembers)
    .innerJoin(users, eq(users.id, clientMembers.userId))
    .where(eq(clientMembers.clientId, clientId))
    .orderBy(asc(users.name));
}

export async function admins() {
  const db = await getDb();
  return db
    .select({ id: users.id, name: users.name, email: users.email, status: users.status, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.role, "admin"))
    .orderBy(asc(users.name));
}

export async function clientLogins() {
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, status: users.status, lastLoginAt: users.lastLoginAt, clientName: clients.name, clientId: clients.id })
    .from(users)
    .leftJoin(clientMembers, eq(clientMembers.userId, users.id))
    .leftJoin(clients, eq(clients.id, clientMembers.clientId))
    .where(eq(users.role, "client"))
    .orderBy(asc(users.name));
  const byUser = new Map<string, { id: string; name: string; email: string; status: string; lastLoginAt: Date | null; clients: { id: string; name: string }[] }>();
  for (const r of rows) {
    const u = byUser.get(r.id) ?? { id: r.id, name: r.name, email: r.email, status: r.status, lastLoginAt: r.lastLoginAt, clients: [] };
    if (r.clientId && r.clientName) u.clients.push({ id: r.clientId, name: r.clientName });
    byUser.set(r.id, u);
  }
  return [...byUser.values()];
}


/** Groups, per-campaign settings and who-can-see-which-group for a client's setup page. */
export async function groupSetup(clientId: string) {
  const db = await getDb();
  const [groups, settings, access] = await Promise.all([
    db.select().from(campaignGroups).where(eq(campaignGroups.clientId, clientId)).orderBy(asc(campaignGroups.sortOrder), asc(campaignGroups.name)),
    db.select().from(campaignSettings).where(eq(campaignSettings.clientId, clientId)),
    db.select().from(memberGroups).where(eq(memberGroups.clientId, clientId)),
  ]);
  const accessByUser = new Map<string, string[]>();
  for (const a of access) accessByUser.set(a.userId, [...(accessByUser.get(a.userId) ?? []), a.groupId]);
  return { groups, settings: new Map(settings.map((s) => [s.campaignId, s])), accessByUser };
}
