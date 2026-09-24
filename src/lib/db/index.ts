import "server-only";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { createDb } from "./connect";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Reuse one connection across hot reloads in dev and across invocations of a
// warm serverless function in production.
const globalForDb = globalThis as unknown as { __twDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__twDb) {
    // Don't cache a failure (e.g. DATABASE_URL missing); the next request retries.
    globalForDb.__twDb = createDb().catch((e) => {
      globalForDb.__twDb = undefined;
      throw e;
    });
  }
  return globalForDb.__twDb;
}

export { schema };
