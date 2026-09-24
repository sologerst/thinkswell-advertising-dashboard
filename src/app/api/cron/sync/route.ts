import { timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { addDays, todayISO } from "@/lib/dates";
import { syncDemo } from "@/lib/sync/demo-sync";
import { refreshCreatives, syncWindsor } from "@/lib/sync/windsor-sync";
import { isLiveMode } from "@/lib/windsor/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Called by Vercel Cron (see vercel.json). Re-pulls a rolling window so late conversions land. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const days = Math.min(90, Math.max(1, Number(process.env.SYNC_LOOKBACK_DAYS ?? 7) || 7));
  const today = todayISO();
  const from = addDays(today, -(days - 1));
  const db = await getDb();
  try {
    if (isLiveMode()) {
      const r = await syncWindsor(db, { from, to: today, triggeredBy: "cron" });
      // Slow (minutes): runs after the response, logged as its own sync run.
      after(() => refreshCreatives(db, { to: today, triggeredBy: "cron" }).catch((e) => console.error("[sync] creative refresh failed", e)));
      return NextResponse.json({ ok: true, source: "windsor", from, to: today, ...r });
    }
    const r = await syncDemo(db, { from, to: today, triggeredBy: "cron" });
    return NextResponse.json({ ok: true, source: "demo", from, to: today, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
