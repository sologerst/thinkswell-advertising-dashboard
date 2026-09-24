import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { cache } from "react";
import { requireClientAccess } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { campaignGroups, campaignSettings, clientMembers, memberGroups, type CampaignGroup, type Client, type GoalType } from "@/lib/db/schema";
import { GOAL_PRESETS } from "@/lib/metrics/catalog";
import { loadScope, narrowScope, type Scope } from "@/lib/metrics/query";

/** What a view measures: its goal (result metric) and ordered KPI cards. */
export type Setup = { goal: GoalType; kpis: string[] };

export function setupFor(client: Pick<Client, "goal" | "kpis">, goal: GoalType | null | undefined): Setup {
  const g = goal ?? client.goal;
  // A different goal gets that goal's preset cards; the client's own goal keeps its custom cards.
  return { goal: g, kpis: g === client.goal && client.kpis.length ? client.kpis : GOAL_PRESETS[g].kpis };
}

/**
 * Everything a client dashboard page needs about who is looking and what they
 * may see: the data scope (narrowed for restricted people), visible campaign
 * groups, and per-campaign display names / groups / goals.
 */
export const loadClientContext = cache(async (slug: string) => {
  const { user, client, isPreview } = await requireClientAccess(slug);
  const db = await getDb();

  const [groups, settings, membership] = await Promise.all([
    db.select().from(campaignGroups).where(eq(campaignGroups.clientId, client.id)).orderBy(asc(campaignGroups.sortOrder), asc(campaignGroups.name)),
    db.select().from(campaignSettings).where(eq(campaignSettings.clientId, client.id)),
    user.role === "admin"
      ? Promise.resolve([])
      : db
          .select()
          .from(clientMembers)
          .where(and(eq(clientMembers.clientId, client.id), eq(clientMembers.userId, user.id))),
  ]);

  const byCampaign = new Map(settings.map((s) => [s.campaignId, s]));
  const campaignsInGroup = new Map<string, string[]>();
  for (const s of settings) {
    if (!s.groupId) continue;
    const list = campaignsInGroup.get(s.groupId) ?? [];
    list.push(s.campaignId);
    campaignsInGroup.set(s.groupId, list);
  }

  let scope: Scope = await loadScope(client);
  let visibleGroups: CampaignGroup[] = groups;
  const restricted = Boolean(membership[0]?.restricted);
  if (restricted) {
    const allowed = new Set(
      (
        await db
          .select({ groupId: memberGroups.groupId })
          .from(memberGroups)
          .where(and(eq(memberGroups.clientId, client.id), eq(memberGroups.userId, user.id)))
      ).map((r) => r.groupId),
    );
    visibleGroups = groups.filter((g) => allowed.has(g.id));
    scope = narrowScope(
      scope,
      visibleGroups.flatMap((g) => campaignsInGroup.get(g.id) ?? []),
    );
  }

  const groupById = new Map(groups.map((g) => [g.id, g]));

  const nameFor = (campaignId: string, fallback: string) => byCampaign.get(campaignId)?.displayName?.trim() || fallback;
  const groupFor = (campaignId: string) => {
    const gid = byCampaign.get(campaignId)?.groupId;
    return gid ? (groupById.get(gid) ?? null) : null;
  };
  const goalFor = (campaignId: string): GoalType => byCampaign.get(campaignId)?.goal ?? groupFor(campaignId)?.goal ?? client.goal;

  // A person limited to groups that all measure the same goal sees that goal by default.
  const sharedGoal =
    restricted && visibleGroups.length > 0 && visibleGroups.every((g) => g.goal && g.goal === visibleGroups[0]!.goal) ? visibleGroups[0]!.goal : null;

  /** Scope + setup for the whole dashboard or one group tab. */
  const view = (groupId: string | null | undefined) => {
    const group = groupId ? visibleGroups.find((g) => g.id === groupId) : undefined;
    if (!group) return { group: null, scope, setup: setupFor(client, sharedGoal) };
    return {
      group,
      scope: narrowScope(scope, campaignsInGroup.get(group.id) ?? []),
      setup: setupFor(client, group.goal),
    };
  };

  return {
    user,
    client,
    isPreview,
    restricted,
    /** The agency fee is between Thinkswell and the client; people limited to certain groups don't see it. */
    showFee: !restricted,
    scope,
    groups: visibleGroups,
    campaignsInGroup,
    nameFor,
    groupFor,
    goalFor,
    view,
  };
});

export type ClientContext = Awaited<ReturnType<typeof loadClientContext>>;
