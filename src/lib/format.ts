import type { MetricFormat } from "@/lib/metrics/catalog";

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const compactUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

export function formatMetric(value: number | null | undefined, format: MetricFormat, opts: { compact?: boolean } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  switch (format) {
    case "currency":
      if (opts.compact && Math.abs(value) >= 10_000) return compactUsd.format(value);
      return Math.abs(value) >= 1000 ? usd0.format(value) : usd2.format(value);
    case "number":
      if (opts.compact && Math.abs(value) >= 10_000) return compact.format(value);
      return int.format(value);
    case "percent":
      return `${(value * 100).toFixed(value < 0.1 ? 2 : 1)}%`;
    case "multiplier":
      return `${value.toFixed(2)}x`;
    case "decimal":
      return value.toFixed(2);
  }
}

/** Short, clean labels for chart axes: $900, $1.2K, 12.5K, 1.5%. */
export function formatAxis(value: number, format: MetricFormat): string {
  if (!Number.isFinite(value)) return "";
  const c = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  switch (format) {
    case "currency":
      return Math.abs(value) >= 1000 ? `$${c(value)}` : Math.abs(value) >= 10 || value === 0 ? `$${Math.round(value)}` : `$${value.toFixed(2)}`;
    case "number":
      return c(value);
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "multiplier":
      return `${value.toFixed(1)}x`;
    case "decimal":
      return value.toFixed(1);
  }
}

export function formatDelta(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  const abs = Math.abs(pct * 100);
  return `${sign}${abs >= 100 ? abs.toFixed(0) : abs.toFixed(1)}%`;
}

export function pctChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / Math.abs(previous);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w[0] ?? ""))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function timeAgo(date: Date | null | undefined): string {
  if (!date) return "never";
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function titleCase(s: string | null | undefined) {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
