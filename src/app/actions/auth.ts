"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { homePathFor } from "@/lib/auth/current";
import { dummyHash, hashPassword, MIN_PASSWORD, verifyPassword } from "@/lib/auth/password";
import { createSession, deleteSession } from "@/lib/auth/session";
import { consumeToken, findValidToken } from "@/lib/auth/tokens";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export type FormState = { error?: string; fieldErrors?: Record<string, string[] | undefined> } | undefined;

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const LoginSchema = z.object({
  email: z.email({ error: "Enter a valid email." }).trim().toLowerCase(),
  password: z.string().min(1, { error: "Enter your password." }),
  next: z.string().optional(),
});

function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : null;
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { email, password, next } = parsed.data;

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  const generic = { error: "That email and password don't match. Try again or ask your Thinkswell team for a reset link." };

  if (!user || !user.passwordHash) {
    await verifyPassword(password, await dummyHash());
    return generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: `Too many attempts. Try again in ${LOCK_MINUTES} minutes, or ask your Thinkswell team for a reset link.` };
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    await db
      .update(users)
      .set({
        failedLogins: failed >= MAX_FAILED ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      })
      .where(eq(users.id, user.id));
    return generic;
  }
  if (user.status === "disabled") return { error: "This login has been turned off. Reach out to your Thinkswell team." };

  await db
    .update(users)
    .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date(), status: "active" })
    .where(eq(users.id, user.id));
  await createSession({ uid: user.id, sv: user.sessionVersion, role: user.role });
  redirect(safeNext(next) ?? (await homePathFor({ ...user, status: "active" })));
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

const PasswordSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(MIN_PASSWORD, { error: `Use at least ${MIN_PASSWORD} characters.` }),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { error: "Passwords don't match.", path: ["confirm"] });

/** Used by both invite links and password-reset links. */
export async function setPasswordFromToken(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = PasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const token = await findValidToken(parsed.data.token);
  if (!token) return { error: "This link has expired or was already used. Ask your Thinkswell team for a fresh one." };

  const db = await getDb();
  const [user] = await db
    .update(users)
    .set({
      passwordHash: await hashPassword(parsed.data.password),
      status: "active",
      failedLogins: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      // Sign out any other sessions.
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(eq(users.id, token.userId))
    .returning();
  await consumeToken(token.id);
  if (!user) return { error: "We couldn't find that account." };

  await createSession({ uid: user.id, sv: user.sessionVersion, role: user.role });
  redirect(await homePathFor(user));
}
