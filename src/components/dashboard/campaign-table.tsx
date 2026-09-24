"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Sparkline } from "@/components/charts/sparkline";
import { StatusPill } from "@/components/ui";
import { formatMetric, titleCase } from "@/lib/format";
import type { MetricFormat } from "@/lib/metrics/catalog";

export type CampaignTableRow = {
  id: string;
  name: string;
  status: string | null;
  objective: string | null;
  spend: number;
  result: number | null;
  cost: number | null;
  ctr: number | null;
  secondary: number | null;
  spark: number[];
  href: string;
};

type Col = { key: "spend" | "result" | "cost" | "ctr" | "secondary"; label: string; format: MetricFormat; lowerIsBetter?: boolean; hideOnMobile?: boolean };

export function CampaignTable({
  rows,
  resultLabel,
  resultFormat,
  costLabel,
  secondaryLabel,
  secondaryFormat,
  searchable = false,
  limit,
  emptyText = "No campaigns delivered in this period.",
}: {
  rows: CampaignTableRow[];
  resultLabel: string;
  resultFormat: MetricFormat;
  costLabel: string;
  secondaryLabel?: string;
  secondaryFormat?: MetricFormat;
  searchable?: boolean;
  limit?: number;
  emptyText?: string;
}) {
  const [sort, setSort] = useState<{ key: Col["key"]; dir: "asc" | "desc" }>({ key: "spend", dir: "desc" });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active">("all");

  const cols: Col[] = [
    { key: "spend", label: "Spend", format: "currency" },
    { key: "result", label: resultLabel, format: resultFormat },
    { key: "cost", label: costLabel, format: "currency", lowerIsBetter: true },
    { key: "ctr", label: "CTR", format: "percent", hideOnMobile: true },
    ...(secondaryLabel ? [{ key: "secondary" as const, label: secondaryLabel, format: secondaryFormat ?? "number", hideOnMobile: true }] : []),
  ];

  const sorted = useMemo(() => {
    let list = rows;
    if (q.trim()) list = list.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()));
    if (status === "active") list = list.filter((r) => r.status?.toUpperCase() === "ACTIVE");
    const dir = sort.dir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * dir;
    });
    return limit ? list.slice(0, limit) : list;
  }, [rows, q, status, sort, limit]);

  const bestCost = useMemo(() => {
    const costs = rows.map((r) => r.cost).filter((c): c is number => c !== null && c > 0);
    return costs.length > 1 ? Math.min(...costs) : null;
  }, [rows]);

  return (
    <div>
      {searchable && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="relative min-w-60 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search campaigns" className="tw-input py-2 pl-9 text-sm" />
          </label>
          <div className="inline-flex rounded-xl border border-line-strong p-1">
            {(["all", "active"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={clsx("rounded-lg px-3 py-1 text-xs font-bold transition", status === s ? "bg-white/10 text-fg" : "text-fg-3 hover:text-fg")}
              >
                {s === "all" ? "All" : "Live only"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-[0.7rem] tracking-wider text-fg-3 uppercase">
              <th className="pb-3 pl-2 font-bold">Campaign</th>
              {cols.map((c) => (
                <th key={c.key} className={clsx("pb-3 text-right font-bold", c.hideOnMobile && "hidden md:table-cell")}>
                  <button
                    type="button"
                    onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === "desc" ? "asc" : "desc" }))}
                    className={clsx("inline-flex items-center gap-1 uppercase transition hover:text-fg", sort.key === c.key && "text-fg")}
                  >
                    {c.label}
                    {sort.key === c.key && (sort.dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
                  </button>
                </th>
              ))}
              <th className="hidden pb-3 pl-4 text-right font-bold lg:table-cell">Trend</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="group relative">
                <td className="border-t border-line py-3.5 pr-4 pl-2">
                  <Link href={r.href} className="block after:absolute after:inset-0 after:content-['']">
                    <div className="max-w-[340px] truncate font-semibold text-fg transition group-hover:text-cyan">{r.name}</div>
                  </Link>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusPill status={r.status} />
                    {r.objective && <span className="text-[0.7rem] text-fg-3">{titleCase(r.objective.replace(/^OUTCOME_/, ""))}</span>}
                  </div>
                </td>
                {cols.map((c) => (
                  <td key={c.key} className={clsx("num border-t border-line py-3.5 text-right text-fg-2", c.hideOnMobile && "hidden md:table-cell")}>
                    <span className={clsx(c.key === "result" && "font-semibold text-fg")}>{formatMetric(r[c.key], c.format)}</span>
                    {c.key === "cost" && bestCost !== null && r.cost === bestCost && (
                      <span className="ml-1.5 rounded-full bg-good/12 px-1.5 py-0.5 text-[0.6rem] font-bold text-good">BEST</span>
                    )}
                  </td>
                ))}
                <td className="hidden border-t border-line py-3.5 pl-4 lg:table-cell">
                  <div className="flex justify-end">
                    <Sparkline values={r.spark} color="var(--color-series-2)" width={88} height={26} fill={false} />
                  </div>
                </td>
                <td className="border-t border-line py-3.5 pr-2 text-right">
                  <ChevronRight className="ml-auto size-4 text-fg-3 transition group-hover:translate-x-0.5 group-hover:text-cyan" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && <p className="py-10 text-center text-sm text-fg-3">{emptyText}</p>}
      </div>
    </div>
  );
}
