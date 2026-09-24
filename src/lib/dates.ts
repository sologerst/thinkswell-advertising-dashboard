/**
 * Date helpers. All report dates are plain `YYYY-MM-DD` strings in the agency's
 * reporting timezone (Meta reports in each ad account's timezone; Thinkswell's
 * accounts run on Central time).
 */

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Chicago";

export type ISODate = string;

export function todayISO(tz = APP_TIMEZONE): ISODate {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function toUTC(d: ISODate) {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y!, m! - 1, day!);
}

function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUTC(toUTC(d) + n * 86_400_000);
}

export function diffDays(from: ISODate, to: ISODate) {
  return Math.round((toUTC(to) - toUTC(from)) / 86_400_000);
}

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function daysInMonth(d: ISODate) {
  const [y, m] = d.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

export function startOfMonth(d: ISODate): ISODate {
  return `${d.slice(0, 7)}-01`;
}

export function isISODate(s: unknown): s is ISODate {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUTC(s));
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions) {
  const k = JSON.stringify(opts);
  let f = fmtCache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" });
    fmtCache.set(k, f);
  }
  return f;
}

export const fmtDay = (d: ISODate) => fmt({ month: "short", day: "numeric" }).format(toUTC(d));
export const fmtWeekday = (d: ISODate) => fmt({ weekday: "short" }).format(toUTC(d));
export const fmtWeekdayLong = (d: ISODate) => fmt({ weekday: "long" }).format(toUTC(d));
export const fmtLong = (d: ISODate) => fmt({ weekday: "long", month: "long", day: "numeric" }).format(toUTC(d));
export const fmtDayYear = (d: ISODate) => fmt({ month: "short", day: "numeric", year: "numeric" }).format(toUTC(d));

export function fmtRange(from: ISODate, to: ISODate) {
  if (from === to) return fmtDayYear(from);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${sameYear ? fmtDay(from) : fmtDayYear(from)} – ${fmtDayYear(to)}`;
}

/* ------------------------------------------------------------------ */
/* Range presets (shared by server pages and the client-side picker)   */
/* ------------------------------------------------------------------ */

export const RANGE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 days" },
  { key: "14d", label: "Last 14 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "mtd", label: "This month" },
  { key: "lastmonth", label: "Last month" },
] as const;

export type RangeKey = (typeof RANGE_PRESETS)[number]["key"] | "custom";

export type DateRange = {
  key: RangeKey;
  label: string;
  from: ISODate;
  to: ISODate;
  /** Equal-length period immediately before, for "vs previous" deltas. */
  prevFrom: ISODate;
  prevTo: ISODate;
};

export const DEFAULT_RANGE: RangeKey = "7d";

export function resolveRange(params: { range?: string; from?: string; to?: string }, today = todayISO()): DateRange {
  let key = (params.range ?? DEFAULT_RANGE) as RangeKey;
  let from: ISODate;
  let to: ISODate;
  const yesterday = addDays(today, -1);

  if (isISODate(params.from) && isISODate(params.to) && (params.range === "custom" || !params.range)) {
    key = "custom";
    [from, to] = params.from <= params.to ? [params.from, params.to] : [params.to, params.from];
    if (to > today) to = today;
    if (diffDays(from, to) > 366) from = addDays(to, -366);
  } else {
    switch (key) {
      case "today":
        from = to = today;
        break;
      case "yesterday":
        from = to = yesterday;
        break;
      case "14d":
        to = yesterday;
        from = addDays(to, -13);
        break;
      case "30d":
        to = yesterday;
        from = addDays(to, -29);
        break;
      case "90d":
        to = yesterday;
        from = addDays(to, -89);
        break;
      case "mtd":
        to = today;
        from = startOfMonth(today);
        break;
      case "lastmonth": {
        to = addDays(startOfMonth(today), -1);
        from = startOfMonth(to);
        break;
      }
      case "7d":
      default:
        key = "7d";
        to = yesterday;
        from = addDays(to, -6);
    }
  }

  const len = diffDays(from, to) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(len - 1));
  const label = key === "custom" ? fmtRange(from, to) : RANGE_PRESETS.find((p) => p.key === key)!.label;
  return { key, label, from, to, prevFrom, prevTo };
}
