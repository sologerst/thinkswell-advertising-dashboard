import clsx from "clsx";
import type { ReactNode } from "react";
import { formatMetric } from "@/lib/format";
import type { MetricFormat } from "@/lib/metrics/catalog";

export type BreakdownColumn<T> = {
  key: string;
  label: string;
  format: MetricFormat;
  get: (row: T) => number | null;
  /** Draws an in-cell bar scaled to the column max. */
  bar?: string;
  strong?: boolean;
  hideOnMobile?: boolean;
};

/** Simple, readable numbers table with optional in-cell bars (server-rendered). */
export function BreakdownTable<T>({
  rows,
  first,
  columns,
  rowKey,
  highlight,
}: {
  rows: T[];
  first: { label: string; render: (row: T) => ReactNode };
  columns: BreakdownColumn<T>[];
  rowKey: (row: T) => string;
  highlight?: (row: T) => boolean;
}) {
  const maxes = Object.fromEntries(columns.map((c) => [c.key, Math.max(0, ...rows.map((r) => c.get(r) ?? 0))]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-[0.7rem] tracking-wider text-fg-3 uppercase">
            <th className="pb-3 pl-2 font-bold">{first.label}</th>
            {columns.map((c) => (
              <th key={c.key} className={clsx("pb-3 pr-2 text-right font-bold", c.hideOnMobile && "hidden md:table-cell")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className={clsx("transition hover:bg-white/[0.025]", highlight?.(r) && "bg-gold/[0.04]")}>
              <td className="border-t border-line py-3 pr-4 pl-2">{first.render(r)}</td>
              {columns.map((c) => {
                const v = c.get(r);
                const max = maxes[c.key] ?? 0;
                return (
                  <td key={c.key} className={clsx("num border-t border-line py-3 pr-2 text-right", c.hideOnMobile && "hidden md:table-cell")}>
                    <div className={clsx(c.strong ? "font-semibold text-fg" : "text-fg-2")}>{formatMetric(v, c.format)}</div>
                    {c.bar && max > 0 && (
                      <div className="mt-1 ml-auto h-1 w-20 overflow-hidden rounded-full bg-white/5">
                        <div className="ml-auto h-full rounded-full" style={{ width: `${Math.max(3, ((v ?? 0) / max) * 100)}%`, background: c.bar }} />
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="py-8 text-center text-sm text-fg-3">Nothing delivered in this period.</p>}
    </div>
  );
}
