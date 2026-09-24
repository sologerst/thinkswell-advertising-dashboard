"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/current";
import { issueToken, tokenLink } from "@/lib/auth/tokens";
import { getDb } from "@/lib/db";
import { clientAccounts, clientCampaigns, clientMembers, clients, users } from "@/lib/db/schema";
import { addDays, todayISO } from "@/lib/dates";
import { sendAccessEmail } from "@/lib/email";
import { GOAL_PRESETS, METRIC_MAP } from "@/lib/metrics/catalog";
import { syncDemo } from "@/lib/sync/demo-sync";
import { syncWindsor } from "@/lib/sync/windsor-sync";
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
  const db = await getDb();
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId.data));
  if (!client) return { error: "Unknown client." };

  let [user] = await db.select().from(users).where(eq(users.email, person.data.email));
  if (user?.role === "admin") return { error: "That email belongs to a Thinkswell admin; admins can already see every client." };
  if (!user) {
    [user] = await db.insert(users).values({ name: person.data.name, email: person.data.email, role: "client", status: "invited" }).returning();
  }
  await db.insert(clientMembers).values({ clientId: client.id, userId: user!.id }).onConflictDoNothing();

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
  await db.delete(clientMembers).where(and(eq(clientMembers.userId, userId), eq(clientMembers.clientId, clientId)));
  revalidatePath(`/admin/clients/${clientId}`);
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
      revalidatePath("/", "layout");
      return {
        ok: `Synced ${r.rows.toLocaleString()} rows from ${r.accounts} ad account${r.accounts === 1 ? "" : "s"}.${r.warnings.length ? ` ${r.warnings.length} warning(s); see the log below.` : ""}`,
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
