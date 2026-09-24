import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { clientMembers, clients, users, type Client, type User } from "@/lib/db/schema";
import { readSession } from "./session";

/** The signed-in, active user, or null. Memoised per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await readSession();
  if (!session) return null;
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, session.uid));
  if (!user || user.status !== "active" || user.sessionVersion !== session.sv) return null;
  return user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

/** Clients this user may open: every client for admins, memberships for everyone else. */
export const listAccessibleClients = cache(async (user: User): Promise<Client[]> => {
  const db = await getDb();
  if (user.role === "admin") {
    return db.select().from(clients).where(isNull(clients.archivedAt)).orderBy(asc(clients.name));
  }
  const rows = await db
    .select({ client: clients })
    .from(clientMembers)
    .innerJoin(clients, eq(clients.id, clientMembers.clientId))
    .where(and(eq(clientMembers.userId, user.id), isNull(clients.archivedAt)))
    .orderBy(asc(clients.name));
  return rows.map((r) => r.client);
});

/**
 * Resolves a client dashboard by slug and enforces access. Admins can open any
 * client (shown as a preview); client users only their own.
 */
export const requireClientAccess = cache(async (slug: string) => {
  const user = await requireUser();
  const db = await getDb();
  const [client] = await db.select().from(clients).where(eq(clients.slug, slug));
  if (!client || client.archivedAt) notFound();
  if (user.role !== "admin") {
    const [m] = await db
      .select()
      .from(clientMembers)
      .where(and(eq(clientMembers.clientId, client.id), eq(clientMembers.userId, user.id)));
    if (!m) notFound();
  }
  return { user, client, isPreview: user.role === "admin" };
});

export async function homePathFor(user: User) {
  if (user.role === "admin") return "/admin";
  const list = await listAccessibleClients(user);
  if (list.length === 0) return "/no-access";
  return `/c/${list[0]!.slug}`;
}
