"use server";

import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/current";
import { issueToken, tokenLink } from "@/lib/auth/tokens";
import { getDb } from "@/lib/db";
import { campaignGroups, campaignSettings, clientAccounts, clientCampaigns, clientMembers, clients, memberGroups, users } from "@/lib/db/schema";
import { addDays, todayISO } from "@/lib/dates";
import { sendAccessEmail } from "@/lib/email";
import { GOAL_PRESETS, METRIC_MAP } from "@/lib/metrics/catalog";
import { syncDemo } from "@/lib/sync/demo-sync";
import { refreshCreatives, syncWindsor } from "@/lib/sync/windsor-sync";
import { isLiveMode, listFacebookAccounts } from "@/lib/windsor/client";

export type ActionState = { ok?: string; error?: string; link?: string; emailed?: boolean } | undefined;

const goalEnum = z.enum(["sales", "leads", "awareness", "traffic"]);
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, { error: "Slug is too short." })
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: "Use lowercase letters, numbers and dashes." });

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Please check the form.";

/* ------------------------------------------------------------------ */
/* Clients                                                             */
/* ------------------------------------------------------------------ */

export async function createClient(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({ name: z.string().trim().min(2, { error: "Give the client a name." }).max(100), slug: z.string().optional(), goal: goalEnum })
    .safeParse({ name: formData.get("name"), slug: formData.get("slug") || undefined, goal: formData.get("goal") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const slug = slugSchema.safeParse(parsed.data.slug || slugify(parsed.data.name));
  if (!slug.success) return { error: firstError(slug.error) };

  const db = await getDb();
  const [clash] = await db.select({ id: clients.id }).from(clients).where(eq(clients.slug, slug.data));
  if (clash) return { error: `The URL /c/${slug.data} is taken. Pick another slug.` };

  const [row] = await db
    .insert(clients)
    .values({ name: parsed.data.name, slug: slug.data, goal: parsed.data.goal, kpis: GOAL_PRESETS[parsed.data.goal].kpis })
    .returning({ id: clients.id });
  revalidatePath("/admin");
  redirect(`/admin/clients/${row!.id}?created=1`);
}

export async function updateClientProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      id: z.uuid(),
      name: z.string().trim().min(2).max(100),
      slug: slugSchema,
      logoUrl: z.union([z.url({ protocol: /^https$/, error: "Logo URL must start with https://" }), z.literal("")]),
      welcomeNote: z.string().trim().max(400, { error: "Keep the note under 400 characters." }),
    })
    .safeParse(Object.fromEntries(["id", "name", "slug", "logoUrl", "welcomeNote"].map((k) => [k, formData.get(k) ?? ""])));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const db = await getDb();
  const [clash] = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.slug, d.slug), ne(clients.id, d.id)));
  if (clash) return { error: `The URL /c/${d.slug} is taken.` };
  await db
    .update(clients)
    .set({ name: d.name, slug: d.slug, logoUrl: d.logoUrl || null, welcomeNote: d.welcomeNote || null, updatedAt: new Date() })
    .where(eq(clients.id, d.id));
  revalidatePath("/admin", "layout");
  return { ok: "Profile saved." };
}

export async function updateClientSetup(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  let kpis: unknown;
  try {
    kpis = JSON.parse(String(formData.get("kpis") ?? "[]"));
  } catch {
    return { error: "Couldn't read the KPI list." };
  }
  const parsed = z
    .object({
      id: z.uuid(),
      goal: goalEnum,
      kpis: z
        .array(z.string().refine((k) => k in METRIC_MAP && k !== "spend"))
        .min(1, { error: "Pick at least one KPI card." })
        .max(10, { error: "Up to 10 KPI cards." }),
    })
    .safeParse({ id: formData.get("id"), goal: formData.get("goal"), kpis });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const db = await getDb();
  await db
    .update(clients)
    .set({ goal: parsed.data.goal, kpis: [...new Set(parsed.data.kpis)], updatedAt: new Date() })
    .where(eq(clients.id, parsed.data.id));
  revalidatePath("/admin", "layout");
  return { ok: "Dashboard setup saved." };
}

export async function updateClientFee(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      id: z.uuid(),
      feeType: z.enum(["none", "percent", "flat", "percent_plus_flat"]),
      feePercent: z.coerce.number().min(0).max(100),
      feeFlatMonthly: z.coerce.number().min(0).max(1_000_000),
      feeLabel: z.string().trim().min(2).max(40),
    })
    .safeParse({
      id: formData.get("id"),
      feeType: formData.get("feeType"),
      feePercent: formData.get("feePercent") || 0,
      feeFlatMonthly: formData.get("feeFlatMonthly") || 0,
      feeLabel: formData.get("feeLabel") || "Agency fee",
    });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const db = await getDb();
  await db
    .update(clients)
    .set({ feeType: d.feeType, feePercent: d.feePercent, feeFlatMonthly: d.feeFlatMonthly, feeLabel: d.feeLabel, updatedAt: new Date() })
    .where(eq(clients.id, d.id));
  revalidatePath("/admin", "layout");
  return { ok: "Agency fee saved." };
}

export async function updateClientAccess(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({
      id: z.uuid(),
      accounts: z.array(z.string().trim().min(1)).max(200),
      campaignMode: z.enum(["all", "include", "exclude"]),
      campaigns: z.array(z.string().trim().min(1)).max(2000),
      campaignNameFilter: z.string().trim().max(100),
    })
    .safeParse({
      id: formData.get("id"),
      accounts: formData.getAll("accounts").map(String),
      campaignMode: formData.get("campaignMode"),
      campaigns: formData.getAll("campaigns").map(String),
      campaignNameFilter: formData.get("campaignNameFilter") ?? "",
    });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  if (d.campaignMode === "include" && d.campaigns.length === 0) {
    return { error: "“Only these campaigns” needs at least one campaign ticked." };
  }
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(clients)
      .set({ campaignMode: d.campaignMode, campaignNameFilter: d.campaignNameFilter || null, updatedAt: new Date() })
      .where(eq(clients.id, d.id));
    await tx.delete(clientAccounts).where(eq(clientAccounts.clientId, d.id));
    if (d.accounts.length) await tx.insert(clientAccounts).values([...new Set(d.accounts)].map((accountId) => ({ clientId: d.id, accountId })));
    await tx.delete(clientCampaigns).where(eq(clientCampaigns.clientId, d.id));
    if (d.campaignMode !== "all" && d.campaigns.length) {
      await tx.insert(clientCampaigns).values([...new Set(d.campaigns)].map((campaignId) => ({ clientId: d.id, campaignId })));
    }
  });
  revalidatePath("/admin", "layout");
  return { ok: "Data access saved." };
}

export async function setClientArchived(formData: FormData) {
  await requireAdmin();
  const id = z.uuid().parse(formData.get("id"));
  const archive = formData.get("archive") === "1";
  const db = await getDb();
  await db
    .update(clients)
    .set({ archivedAt: archive ? new Date() : null, updatedAt: new Date() })
    .where(eq(clients.id, id));
  revalidatePath("/admin", "layout");
  if (archive) redirect("/admin");
}

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

const PersonSchema = z.object({
  name: z.string().trim().min(2, { error: "Add their name." }).max(100),
  email: z.email({ error: "Enter a valid email." }).trim().toLowerCase(),
});

/** Adds someone to a client (creating their login if needed) and returns an invite link. */
export async function inviteClientUser(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const clientId = z.uuid().safeParse(formData.get("clientId"));
  const person = PersonSchema.safeParse({ name: formData.get("name"), email: formData.get("email") });
  if (!clientId.success) return { error: "Unknown client." };
  if (!person.success) return { error: firstError(person.error) };
  const groupIds = formData.getAll("groups").map(String).filter(Boolean);
  if (formData.get("access") === "groups" && groupIds.length === 0) return { error: "Tick at least one group, or choose “All campaigns”." };
  const db = await getDb();
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId.data));
  if (!client) return { error: "Unknown client." };

  let [user] = await db.select().from(users).where(eq(users.email, person.data.email));
  if (user?.role === "admin") return { error: "That email belongs to a Thinkswell admin; admins can already see every client." };
  if (!user) {
    [user] = await db.insert(users).values({ name: person.data.name, email: person.data.email, role: "client", status: "invited" }).returning();
  }
  const added = await db.insert(clientMembers).values({ clientId: client.id, userId: user!.id }).onConflictDoNothing().returning();
  // New members get the access picked on the form; existing members only change if groups were ticked.
  if (added.length || groupIds.length) {
    const err = await applyMemberAccess(client.id, user!.id, groupIds.length ? groupIds : null);
    if (err) return { error: err };
  }

  // Existing active users just gain access; new ones need a link to set a password.
  if (user!.status === "active" && user!.passwordHash) {
    revalidatePath(`/admin/clients/${client.id}`);
    return { ok: `${user!.name} already has a login. They'll see ${client.name} in their dashboard switcher.` };
  }
  const link = tokenLink(await issueToken(user!.id, "invite"));
  const emailed = await sendAccessEmail({ to: user!.email, name: user!.name, link, kind: "invite", clientName: client.name, from: admin.name });
  revalidatePath(`/admin/clients/${client.id}`);
  return { ok: emailed ? `Invite emailed to ${user!.email}.` : `Login created for ${user!.name}. Send them this link:`, link, emailed };
}

export async function inviteAdmin(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const person = PersonSchema.safeParse({ name: formData.get("name"), email: formData.get("email") });
  if (!person.success) return { error: firstError(person.error) };
  const db = await getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, person.data.email));
  if (existing?.role === "client") return { error: "That email is a client login. Use a different email for admin access." };
  if (existing) return { error: "That person is already on the team." };
  const [user] = await db.insert(users).values({ name: person.data.name, email: person.data.email, role: "admin", status: "invited" }).returning();
  const link = tokenLink(await issueToken(user!.id, "invite"));
  const emailed = await sendAccessEmail({ to: user!.email, name: user!.name, link, kind: "invite", clientName: "Thinkswell admin", from: admin.name });
  revalidatePath("/admin/team");
  return { ok: emailed ? `Invite emailed to ${user!.email}.` : `Admin login created. Send ${user!.name} this link:`, link, emailed };
}

/** Fresh single-use link: an invite for people who never set a password, otherwise a reset. */
export async function createAccessLink(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const userId = z.uuid().safeParse(formData.get("userId"));
  if (!userId.success) return { error: "Unknown user." };
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId.data));
  if (!user) return { error: "Unknown user." };
  const kind = user.passwordHash ? "reset" : "invite";
  const link = tokenLink(await issueToken(user.id, kind));
  const emailed = formData.get("email") === "1" ? await sendAccessEmail({ to: user.email, name: user.name, link, kind, from: admin.name }) : false;
  return { ok: emailed ? `Link emailed to ${user.email}.` : `${kind === "reset" ? "Password reset" : "Invite"} link for ${user.name} (works once, expires soon):`, link, emailed };
}

export async function setUserDisabled(formData: FormData) {
  const admin = await requireAdmin();
  const userId = z.uuid().parse(formData.get("userId"));
  if (userId === admin.id) return;
  const disable = formData.get("disable") === "1";
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return;
  await db
    .update(users)
    .set({
      status: disable ? "disabled" : user.passwordHash ? "active" : "invited",
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(eq(users.id, userId));
  revalidatePath("/admin", "layout");
}

export async function removeMember(formData: FormData) {
  await requireAdmin();
  const userId = z.uuid().parse(formData.get("userId"));
  const clientId = z.uuid().parse(formData.get("clientId"));
  const db = await getDb();
  await db.delete(memberGroups).where(and(eq(memberGroups.userId, userId), eq(memberGroups.clientId, clientId)));
  await db.delete(clientMembers).where(and(eq(clientMembers.userId, userId), eq(clientMembers.clientId, clientId)));
  revalidatePath(`/admin/clients/${clientId}`);
}

/* ------------------------------------------------------------------ */
/* Campaign groups, friendly names, per-campaign goals, member access  */
/* ------------------------------------------------------------------ */

const optionalGoal = z.union([goalEnum, z.literal(""), z.null()]).transform((g) => (g ? g : null));

/** Replaces a client's group list (create, rename, re-goal, reorder, delete). */
export async function saveGroups(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const clientId = z.uuid().safeParse(formData.get("clientId"));
  if (!clientId.success) return { error: "Unknown client." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("groups") ?? "[]"));
  } catch {
    return { error: "Couldn't read the group list." };
  }
  const parsed = z
    .array(z.object({ id: z.uuid().optional(), name: z.string().trim().min(1, { error: "Every group needs a name." }).max(60), goal: optionalGoal }))
    .max(30, { error: "Up to 30 groups per client." })
    .safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const names = parsed.data.map((g) => g.name.toLowerCase());
  if (new Set(names).size !== names.length) return { error: "Two groups have the same name." };

  const db = await getDb();
  await db.transaction(async (tx) => {
    const existing = await tx.select({ id: campaignGroups.id }).from(campaignGroups).where(eq(campaignGroups.clientId, clientId.data));
    const existingIds = new Set(existing.map((g) => g.id));
    const keep = parsed.data.filter((g) => g.id && existingIds.has(g.id)).map((g) => g.id!);
    // Deleting a group ungroups its campaigns (FK set null) and drops it from people's access.
    await tx
      .delete(campaignGroups)
      .where(and(eq(campaignGroups.clientId, clientId.data), keep.length ? notInArray(campaignGroups.id, keep) : undefined));
    for (const [i, g] of parsed.data.entries()) {
      if (g.id && existingIds.has(g.id)) {
        await tx.update(campaignGroups).set({ name: g.name, goal: g.goal, sortOrder: i }).where(eq(campaignGroups.id, g.id));
      } else {
        await tx.insert(campaignGroups).values({ clientId: clientId.data, name: g.name, goal: g.goal, sortOrder: i });
      }
    }
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/c/[slug]", "layout");
  return { ok: "Groups saved." };
}

/** Saves friendly names, group assignments and goal overrides for a client's campaigns. */
export async function saveCampaignSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const clientId = z.uuid().safeParse(formData.get("clientId"));
  if (!clientId.success) return { error: "Unknown client." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("settings") ?? "[]"));
  } catch {
    return { error: "Couldn't read the campaign list." };
  }
  const parsed = z
    .array(
      z.object({
        campaignId: z.string().trim().min(1).max(64),
        displayName: z.string().trim().max(120),
        groupId: z.union([z.uuid(), z.literal(""), z.null()]).transform((g) => (g ? g : null)),
        goal: optionalGoal,
      }),
    )
    .max(2000)
    .safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const db = await getDb();
  const groups = await db.select({ id: campaignGroups.id }).from(campaignGroups).where(eq(campaignGroups.clientId, clientId.data));
  const valid = new Set(groups.map((g) => g.id));
  if (parsed.data.some((r) => r.groupId && !valid.has(r.groupId))) return { error: "One of the groups no longer exists. Reload and try again." };

  await db.transaction(async (tx) => {
    for (const r of parsed.data) {
      const empty = !r.displayName && !r.groupId && !r.goal;
      if (empty) {
        await tx.delete(campaignSettings).where(and(eq(campaignSettings.clientId, clientId.data), eq(campaignSettings.campaignId, r.campaignId)));
        continue;
      }
      await tx
        .insert(campaignSettings)
        .values({ clientId: clientId.data, campaignId: r.campaignId, displayName: r.displayName || null, groupId: r.groupId, goal: r.goal })
        .onConflictDoUpdate({
          target: [campaignSettings.clientId, campaignSettings.campaignId],
          set: { displayName: r.displayName || null, groupId: r.groupId, goal: r.goal },
        });
    }
  });
  revalidatePath("/admin", "layout");
  revalidatePath("/c/[slug]", "layout");
  return { ok: "Campaign settings saved." };
}

/** null = sees every campaign the client can see; [] or ids = only those groups. */
async function applyMemberAccess(clientId: string, userId: string, groupIds: string[] | null): Promise<string | null> {
  const db = await getDb();
  if (groupIds?.length) {
    const found = await db
      .select({ id: campaignGroups.id })
      .from(campaignGroups)
      .where(and(eq(campaignGroups.clientId, clientId), inArray(campaignGroups.id, groupIds)));
    if (found.length !== new Set(groupIds).size) return "One of the groups no longer exists. Reload and try again.";
  }
  await db.transaction(async (tx) => {
    await tx
      .update(clientMembers)
      .set({ restricted: groupIds !== null })
      .where(and(eq(clientMembers.clientId, clientId), eq(clientMembers.userId, userId)));
    await tx.delete(memberGroups).where(and(eq(memberGroups.clientId, clientId), eq(memberGroups.userId, userId)));
    if (groupIds?.length) {
      await tx.insert(memberGroups).values([...new Set(groupIds)].map((groupId) => ({ clientId, userId, groupId })));
    }
  });
  return null;
}

export async function setMemberAccess(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const clientId = z.uuid().safeParse(formData.get("clientId"));
  const userId = z.uuid().safeParse(formData.get("userId"));
  if (!clientId.success || !userId.success) return { error: "Unknown person." };
  const mode = formData.get("access");
  const groupIds = formData.getAll("groups").map(String).filter(Boolean);
  if (mode === "groups" && groupIds.length === 0) return { error: "Tick at least one group, or choose “All campaigns”." };
  const err = await applyMemberAccess(clientId.data, userId.data, mode === "groups" ? groupIds : null);
  if (err) return { error: err };
  revalidatePath(`/admin/clients/${clientId.data}`);
  return { ok: mode === "groups" ? "Access limited to the selected groups." : "Access set to all campaigns." };
}

/* ------------------------------------------------------------------ */
/* Data sync                                                           */
/* ------------------------------------------------------------------ */

export async function runSync(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const days = Math.min(365, Math.max(1, Number(formData.get("days") ?? 7) || 7));
  const today = todayISO();
  const from = addDays(today, -(days - 1));
  const db = await getDb();
  try {
    if (isLiveMode()) {
      const r = await syncWindsor(db, { from, to: today, triggeredBy: admin.email });
      after(() => refreshCreatives(db, { to: today, triggeredBy: admin.email }).catch((e) => console.error("[sync] creative refresh failed", e)));
      revalidatePath("/", "layout");
      return {
        ok: `Synced ${r.rows.toLocaleString()} rows from ${r.accounts} ad account${r.accounts === 1 ? "" : "s"}.${r.warnings.length ? ` ${r.warnings.length} warning(s); see the log below.` : ""} Ad previews keep refreshing in the background for a few minutes.`,
      };
    }
    const r = await syncDemo(db, { from, to: today, triggeredBy: admin.email });
    revalidatePath("/", "layout");
    return { ok: `Demo data refreshed (${r.rows.toLocaleString()} rows). Add WINDSOR_API_KEY to pull real Meta data.` };
  } catch (e) {
    revalidatePath("/admin/data");
    return { error: (e as Error).message };
  }
}

export async function testWindsor(): Promise<ActionState> {
  await requireAdmin();
  if (!isLiveMode()) return { error: "WINDSOR_API_KEY isn't set yet." };
  try {
    const accounts = await listFacebookAccounts();
    if (!accounts.length) return { error: "Connected, but Windsor returned no Facebook accounts. Double-check the key and that Meta is connected in Windsor." };
    return { ok: `Connected. Windsor sees ${accounts.length} Meta ad account${accounts.length === 1 ? "" : "s"}: ${accounts.map((a) => a.name).join(", ")}.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
