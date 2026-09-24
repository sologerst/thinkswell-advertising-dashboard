import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { authTokens, type TokenPurpose } from "@/lib/db/schema";

const TTL_HOURS: Record<TokenPurpose, number> = { invite: 24 * 7, reset: 24 };

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a single-use link token. Only the hash is stored. */
export async function issueToken(userId: string, purpose: TokenPurpose) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  // Invalidate any older unused links of the same kind.
  await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose), isNull(authTokens.usedAt)));
  await db.insert(authTokens).values({
    userId,
    purpose,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + TTL_HOURS[purpose] * 3_600_000),
  });
  return token;
}

export async function findValidToken(token: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, hash(token)), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())));
  return row ?? null;
}

export async function consumeToken(id: string) {
  const db = await getDb();
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, id));
}

export function appUrl() {
  const explicit = process.env.APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export function tokenLink(token: string) {
  return `${appUrl()}/welcome/${token}`;
}
