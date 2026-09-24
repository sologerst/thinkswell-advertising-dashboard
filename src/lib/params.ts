import { APP_TIMEZONE, resolveRange, todayISO } from "@/lib/dates";

type SP = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function readDashboardParams(sp: SP) {
  const today = todayISO();
  const range = resolveRange({ range: one(sp.range), from: one(sp.from), to: one(sp.to) }, today);
  const p = one(sp.platform);
  const platform = p === "facebook" || p === "instagram" ? p : null;
  return { today, range, platform };
}

/** Query string that keeps the current range/platform when linking around. */
export function keepQuery(sp: SP, overrides: Record<string, string | null> = {}) {
  const q = new URLSearchParams();
  for (const k of ["range", "from", "to", "platform"]) {
    const v = one(sp[k]);
    if (v) q.set(k, v);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: APP_TIMEZONE, hour: "numeric", hour12: false }).format(new Date())) % 24;
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
