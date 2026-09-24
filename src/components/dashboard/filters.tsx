"use client";

import clsx from "clsx";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { FacebookIcon, InstagramIcon } from "@/components/icons";
import { RANGE_PRESETS, type RangeKey } from "@/lib/dates";

type Current = { range: RangeKey; label: string; from: string; to: string; platform: string | null };

function useNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const go = (params: Record<string, string | null>) => {
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    const q = sp.toString();
    start(() => router.push(q ? `${pathname}?${q}` : pathname, { scroll: false }));
  };
  return { go, pending };
}

export function DateRangePicker({ current, today }: { current: Current; today: string }) {
  const { go, pending } = useNav();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(current.from);
  const [to, setTo] = useState(current.to);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={clsx(
          "inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-ink-800/80 px-3.5 text-sm font-semibold text-fg backdrop-blur transition hover:border-cyan/50",
          pending && "opacity-70",
        )}
      >
        <CalendarDays className="size-4 text-cyan" />
        {current.label}
        <ChevronDown className={clsx("size-4 text-fg-3 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-line-strong bg-ink-750 p-1.5 shadow-2xl animate-rise [animation-duration:.25s]">
          {RANGE_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setOpen(false);
                go({ range: p.key, from: null, to: null });
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-fg-2 transition hover:bg-white/5 hover:text-fg"
            >
              {p.label}
              {current.range === p.key && <Check className="size-4 text-cyan" strokeWidth={3} />}
            </button>
          ))}
          <div className="mt-1.5 border-t border-line p-2">
            <div className="eyebrow mb-2">Custom range</div>
            <div className="flex items-center gap-2">
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="tw-input px-2 py-1.5 text-xs" aria-label="From" />
              <span className="text-fg-3">–</span>
              <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="tw-input px-2 py-1.5 text-xs" aria-label="To" />
            </div>
            <button
              type="button"
              disabled={!from || !to}
              onClick={() => {
                setOpen(false);
                go({ range: "custom", from, to });
              }}
              className="mt-2 w-full rounded-xl bg-cyan py-2 text-xs font-bold text-ink-850 transition hover:bg-[#6fd8f3]"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const PLATFORMS = [
  { key: null, label: "All", icon: null },
  { key: "facebook", label: "Facebook", icon: FacebookIcon },
  { key: "instagram", label: "Instagram", icon: InstagramIcon },
] as const;

export function PlatformToggle({ current }: { current: string | null }) {
  const { go } = useNav();
  return (
    <div role="radiogroup" aria-label="Platform" className="inline-flex h-10 items-center gap-0.5 rounded-xl border border-line-strong bg-ink-800/80 p-1 backdrop-blur">
      {PLATFORMS.map((p) => {
        const active = (current ?? null) === p.key;
        const Icon = p.icon;
        return (
          <button
            key={p.label}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => go({ platform: p.key })}
            className={clsx(
              "inline-flex h-full items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition",
              active ? "bg-white/10 text-fg shadow-inner" : "text-fg-3 hover:text-fg",
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            <span className={clsx(Icon && "hidden sm:inline")}>{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}
