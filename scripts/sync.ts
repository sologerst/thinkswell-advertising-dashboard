/**
 * npm run sync                  -> pull the last 7 days from Windsor (or refresh demo data)
 * npm run sync -- --days 90     -> backfill 90 days
 * npm run sync -- --from 2026-01-01 --to 2026-01-31
 */
import { createDb, runMigrations } from "@/lib/db/connect";
import { addDays, isISODate, todayISO } from "@/lib/dates";
import { syncDemo } from "@/lib/sync/demo-sync";
import { syncWindsor } from "@/lib/sync/windsor-sync";
import { isLiveMode } from "@/lib/windsor/client";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const db = await createDb();
  await runMigrations(db);
  const today = todayISO();
  const days = Number(arg("days") ?? 7);
  const from = isISODate(arg("from")) ? arg("from")! : addDays(today, -(days - 1));
  const to = isISODate(arg("to")) ? arg("to")! : today;

  if (isLiveMode()) {
    const r = await syncWindsor(db, { from, to, triggeredBy: "cli" });
    console.log(`✓ Windsor sync ${from} → ${to}: ${r.rows} rows across ${r.accounts} accounts`);
    for (const w of r.warnings) console.warn(`  ! ${w}`);
  } else {
    const r = await syncDemo(db, { from, to, triggeredBy: "cli" });
    console.log(`✓ Demo data refreshed ${from} → ${to}: ${r.rows} rows (set WINDSOR_API_KEY for live data)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
