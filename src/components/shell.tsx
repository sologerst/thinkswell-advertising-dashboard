"use client";

import clsx from "clsx";
import { Check, ChevronDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import { Avatar, ClientBadge } from "@/components/ui";

function useDismiss(open: boolean, setOpen: (o: boolean) => void) {
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
  }, [open, setOpen]);
  return ref;
}

export function Dropdown({ trigger, children, align = "right", width = "w-64" }: { trigger: (open: boolean) => ReactNode; children: ReactNode; align?: "left" | "right"; width?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, setOpen);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="block">
        {trigger(open)}
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className={clsx(
            "absolute z-50 mt-2 overflow-hidden rounded-2xl border border-line-strong bg-ink-750 p-1.5 shadow-2xl animate-rise [animation-duration:.25s]",
            align === "right" ? "right-0" : "left-0",
            width,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function ClientSwitcher({ current, clients }: { current: { name: string; slug: string; logoUrl: string | null }; clients: { name: string; slug: string; logoUrl: string | null }[] }) {
  const label = (
    <span className="inline-flex items-center gap-2.5">
      <ClientBadge name={current.name} logoUrl={current.logoUrl} className="size-8! rounded-lg!" />
      <span className="max-w-[180px] truncate text-sm font-semibold text-fg">{current.name}</span>
    </span>
  );
  if (clients.length <= 1) return label;
  return (
    <Dropdown
      align="left"
      width="w-72"
      trigger={(open) => (
        <span className="inline-flex items-center gap-1.5 rounded-xl py-1 pr-2 pl-1 transition hover:bg-white/5">
          {label}
          <ChevronDown className={clsx("size-4 text-fg-3 transition", open && "rotate-180")} />
        </span>
      )}
    >
      <div className="eyebrow px-3 pt-2 pb-1.5">Switch dashboard</div>
      <div className="max-h-80 overflow-y-auto">
        {clients.map((c) => (
          <Link key={c.slug} href={`/c/${c.slug}`} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-fg-2 transition hover:bg-white/5 hover:text-fg">
            <ClientBadge name={c.name} logoUrl={c.logoUrl} className="size-7! rounded-lg! text-[0.6rem]!" />
            <span className="flex-1 truncate">{c.name}</span>
            {c.slug === current.slug && <Check className="size-4 text-cyan" strokeWidth={3} />}
          </Link>
        ))}
      </div>
    </Dropdown>
  );
}

export function NavTabs({ tabs }: { tabs: { href: string; label: string; exact?: boolean }[] }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const keep = new URLSearchParams();
  for (const k of ["range", "from", "to", "platform"]) {
    const v = sp.get(k);
    if (v) keep.set(k, v);
  }
  const qs = keep.toString();
  return (
    <nav className="flex items-center gap-1">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={qs && !t.href.startsWith("/admin") ? `${t.href}?${qs}` : t.href}
            className={clsx(
              "relative rounded-xl px-3.5 py-2 text-sm font-semibold transition",
              active ? "text-fg" : "text-fg-3 hover:bg-white/5 hover:text-fg",
            )}
          >
            {t.label}
            {active && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-cyan shadow-[0_0_12px_rgb(73_203_237/0.8)]" />}
          </Link>
        );
      })}
    </nav>
  );
}

export function UserMenu({ name, email, isAdmin }: { name: string; email: string; isAdmin: boolean }) {
  return (
    <Dropdown trigger={() => <Avatar name={name} className="ring-2 ring-transparent transition hover:ring-cyan/40" />}>
      <div className="px-3 pt-2 pb-3">
        <div className="text-sm font-semibold text-fg">{name}</div>
        <div className="truncate text-xs text-fg-3">{email}</div>
      </div>
      <div className="border-t border-line pt-1.5">
        {isAdmin && (
          <Link href="/admin" className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-fg-2 transition hover:bg-white/5 hover:text-fg">
            <Settings className="size-4" /> Admin console
          </Link>
        )}
        <form action={logout}>
          <button type="submit" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-fg-2 transition hover:bg-white/5 hover:text-fg">
            <LogOut className="size-4" /> Sign out
          </button>
        </form>
      </div>
    </Dropdown>
  );
}
