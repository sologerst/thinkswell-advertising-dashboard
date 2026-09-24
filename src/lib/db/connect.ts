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
    // Vercel functions are IPv4-only; Supabase's direct host and Dedicated Pooler (both db.<ref>.supabase.co) are IPv6-only.
    throw new Error(
      "DATABASE_URL points at db.<ref>.supabase.co (Supabase's direct connection or Dedicated Pooler), which is IPv6-only and unreachable from Vercel. Use the Shared Pooler (Supavisor) transaction-mode string instead: postgresql://postgres.<ref>:<password>@aws-…-<region>.pooler.supabase.com:6543/postgres",
    );
  }
  if (url) {
    // node-postgres runs one query per connection at a time. (postgres.js pipelines
    // concurrent queries on a connection, which stalls behind Supabase's
    // transaction-mode pooler.)
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const pool = new Pool({
      ...pgConnectionConfig(url),
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idleTimeoutMillis: 10_000,
      // Fail loudly instead of hanging if the database is unreachable or stuck.
      connectionTimeoutMillis: 10_000,
      query_timeout: 30_000,
    });
    return drizzle(pool, { schema }) as unknown as Db;
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

/**
 * Encrypt connections to remote databases. Supabase's certificate chains to its
 * own CA (not in Node's store), so the connection is encrypted without chain
 * verification. Local databases and DATABASE_SSL=disable connect in plain text.
 */
export function pgConnectionConfig(url: string) {
  const u = new URL(url);
  const local = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
  const disable = process.env.DATABASE_SSL === "disable" || u.searchParams.get("sslmode") === "disable";
  // node-postgres lets URL ssl params override the ssl option, so drop them and decide here.
  for (const k of ["sslmode", "ssl", "sslrootcert", "sslcert", "sslkey"]) u.searchParams.delete(k);
  return { connectionString: u.toString(), ssl: local || disable ? false : { rejectUnauthorized: false } };
}

export async function runMigrations(db: Db) {
  if (process.env.DATABASE_URL) {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: MIGRATIONS_DIR });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: MIGRATIONS_DIR });
  }
}
