import { addDays, addMonths, type ISODate } from "@/lib/dates";

/**
 * History backfills (Admin → Data) run as a series of short windows, one
 * request each, so no single sync gets near the 300s function limit.
 */

/** Same window as the "Backfill 90 days" button, which syncs comfortably inside the limit. */
export const BACKFILL_CHUNK_DAYS = 90;

/** Meta keeps ad insights for 37 months. */
export const META_HISTORY_MONTHS = 37;

export function earliestBackfillDate(today: ISODate): ISODate {
  return addMonths(today, -META_HISTORY_MONTHS);
}

export type BackfillWindow = { from: ISODate; to: ISODate };

/** [from, to] split into windows of at most BACKFILL_CHUNK_DAYS, newest first. */
export function backfillWindows(from: ISODate, to: ISODate): BackfillWindow[] {
  const out: BackfillWindow[] = [];
  for (let end = to; end >= from; ) {
    const start = addDays(end, -(BACKFILL_CHUNK_DAYS - 1));
    out.push({ from: start < from ? from : start, to: end });
    end = addDays(start, -1);
  }
  return out;
}

/**
 * Suggested dates: fill in the last 12 months up to the oldest synced day, or
 * once that's covered, the 12 months before it.
 */
export function defaultBackfillRange(today: ISODate, oldest: ISODate | null): BackfillWindow {
  const earliest = earliestBackfillDate(today);
  const yearAgo = addMonths(today, -12);
  if (!oldest) return { from: yearAgo, to: today };
  const to = addDays(oldest, -1);
  const from = oldest > yearAgo ? yearAgo : addMonths(oldest, -12);
  const clamped = from < earliest ? earliest : from;
  return clamped <= to ? { from: clamped, to } : { from: yearAgo, to: today };
}
