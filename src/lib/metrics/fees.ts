import type { Client, FeeType } from "@/lib/db/schema";
import { daysInMonth, type ISODate } from "@/lib/dates";
import { formatMetric } from "@/lib/format";

export type FeeConfig = Pick<Client, "feeType" | "feePercent" | "feeFlatMonthly" | "feeLabel">;

export function hasFee(c: FeeConfig) {
  return c.feeType !== "none" && (c.feePercent > 0 || c.feeFlatMonthly > 0);
}

/**
 * Agency fee for one day: a % of that day's ad spend and/or the monthly
 * retainer spread evenly across the days of that month.
 */
export function feeForDay(c: FeeConfig, date: ISODate, spend: number): number {
  let fee = 0;
  if (c.feeType === "percent" || c.feeType === "percent_plus_flat") fee += spend * (c.feePercent / 100);
  if (c.feeType === "flat" || c.feeType === "percent_plus_flat") fee += c.feeFlatMonthly / daysInMonth(date);
  return fee;
}

export function feeForDays(c: FeeConfig, days: { date: ISODate; spend: number }[]) {
  return days.reduce((sum, d) => sum + feeForDay(c, d.date, d.spend), 0);
}

export function describeFee(c: FeeConfig): string {
  const pct = `${Number(c.feePercent.toFixed(2))}% of ad spend`;
  const flat = `${formatMetric(c.feeFlatMonthly, "currency")}/mo retainer`;
  const map: Record<FeeType, string> = {
    none: "No agency fee",
    percent: pct,
    flat,
    percent_plus_flat: `${flat} + ${pct}`,
  };
  return map[c.feeType];
}

/**
 * Fee shown on a single campaign-group tab: only the %-of-spend part applies to
 * a slice of campaigns; a monthly retainer stays on the whole-client view.
 */
export function groupFeeConfig(c: FeeConfig): FeeConfig | null {
  if (c.feeType === "percent" || c.feeType === "percent_plus_flat") return { ...c, feeType: "percent" };
  return null;
}
