import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");
export const LOCAL_DB_DIR = path.join(process.cwd(), ".data", "pglite");

/**
 * DATABASE_URL set  -> real Postgres (Supabase in production).
 * DATABASE_URL unset -> embedded PGlite under .data/ so the app runs locally
 *                       with zero setup.
 *
 * Shared by the app and the CLI scripts (so no `server-only` import here).
 */
export async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url && process.env.VERCEL && /@db\.[a-z0-9]+\.supabase\.co/i.test(url)) {
    // Vercel functions are IPv4-only; Supabase's direct host is IPv6-only.
    throw new Error(
      "DATABASE_URL uses Supabase's direct host (db.<ref>.supabase.co), which Vercel can't reach. Use the Transaction pooler connection string (…pooler.supabase.com:6543) instead.",
    );
  }
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = postgres(url, {
      // Supabase's transaction pooler (port 6543) doesn't support prepared statements.
      prepare: false,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    });
    return drizzle(client, { schema }) as unknown as Db;
  }

  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is required in production (use your Supabase connection string).");
  }

  const { mkdirSync } = await import("node:fs");
  mkdirSync(LOCAL_DB_DIR, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite(LOCAL_DB_DIR);
  return drizzle(client, { schema }) as unknown as Db;
}

export async function runMigrations(db: Db) {
  if (process.env.DATABASE_URL) {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: MIGRATIONS_DIR });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: MIGRATIONS_DIR });
  }
}
