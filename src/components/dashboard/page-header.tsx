import type { ReactNode } from "react";
import { DateRangePicker, PlatformToggle } from "@/components/dashboard/filters";
import type { DateRange } from "@/lib/dates";
import { timeAgo } from "@/lib/format";

export function DashboardHeader({
  eyebrow,
  title,
  subtitle,
  range,
  platform,
  today,
  synced,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  range: DateRange;
  platform: string | null;
  today: string;
  synced?: Date | null;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0 animate-rise">
        <div className="eyebrow mb-2 flex flex-wrap items-center gap-2">{eyebrow}</div>
        <h1 className="font-serif text-[2.2rem] leading-[1.05] text-fg sm:text-[2.75rem]">{title}</h1>
        {(subtitle || synced !== undefined) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-2">
            {subtitle}
            {synced !== undefined && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink-800/70 px-2.5 py-0.5 text-xs text-fg-3">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-good/60" />
                  <span className="relative inline-flex size-2 rounded-full bg-good" />
                </span>
                Synced {timeAgo(synced)}
              </span>
            )}
          </div>
        )}
        {children}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PlatformToggle current={platform} />
        <DateRangePicker current={{ range: range.key, label: range.label, from: range.from, to: range.to, platform }} today={today} />
      </div>
    </div>
  );
}
