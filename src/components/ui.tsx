import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { initials } from "@/lib/format";

type Variant = "primary" | "gold" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-cyan text-ink-850 hover:bg-[#6fd8f3] shadow-[0_8px_24px_-10px_rgb(73_203_237/0.7)]",
  gold: "bg-gold text-ink-850 hover:bg-[#f9ca66] shadow-[0_8px_24px_-10px_rgb(247_189_69/0.6)]",
  secondary: "bg-ink-750 text-fg border border-line-strong hover:bg-ink-700",
  ghost: "text-fg-2 hover:text-fg hover:bg-white/5",
  danger: "bg-bad/10 text-bad border border-bad/30 hover:bg-bad/20",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[0.82rem] font-bold tracking-[0.02em] transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan/25";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={clsx(base, variants[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={clsx(base, variants[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("tw-card", className)} {...props} />;
}

export function SectionTitle({ eyebrow, title, action, className }: { eyebrow?: string; title: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-wrap items-end justify-between gap-3", className)}>
      <div>
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h2 className="font-serif text-[1.55rem] leading-tight text-fg">{title}</h2>
      </div>
      {action}
    </div>
  );
}

const STATUS_STYLES: Record<string, { dot: string; label: string; cls: string }> = {
  ACTIVE: { dot: "bg-good", label: "Live", cls: "text-good bg-good/10 border-good/25" },
  PAUSED: { dot: "bg-gold", label: "Paused", cls: "text-gold bg-gold/10 border-gold/25" },
  COMPLETED: { dot: "bg-fg-3", label: "Ended", cls: "text-fg-2 bg-white/5 border-line" },
  ARCHIVED: { dot: "bg-fg-3", label: "Archived", cls: "text-fg-2 bg-white/5 border-line" },
  DELETED: { dot: "bg-fg-3", label: "Deleted", cls: "text-fg-2 bg-white/5 border-line" },
  CAMPAIGN_PAUSED: { dot: "bg-gold", label: "Paused", cls: "text-gold bg-gold/10 border-gold/25" },
  ADSET_PAUSED: { dot: "bg-gold", label: "Paused", cls: "text-gold bg-gold/10 border-gold/25" },
  IN_PROCESS: { dot: "bg-cyan", label: "Processing", cls: "text-cyan bg-cyan/10 border-cyan/25" },
  WITH_ISSUES: { dot: "bg-bad", label: "Issues", cls: "text-bad bg-bad/10 border-bad/25" },
  DISAPPROVED: { dot: "bg-bad", label: "Rejected", cls: "text-bad bg-bad/10 border-bad/25" },
  PENDING_REVIEW: { dot: "bg-cyan", label: "In review", cls: "text-cyan bg-cyan/10 border-cyan/25" },
};

export function StatusPill({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return null;
  const s = STATUS_STYLES[status.toUpperCase()] ?? { dot: "bg-fg-3", label: status.toLowerCase().replace(/_/g, " "), cls: "text-fg-2 bg-white/5 border-line" };
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold capitalize", s.cls, className)}>
      <span className={clsx("size-1.5 rounded-full", s.dot, status.toUpperCase() === "ACTIVE" && "animate-pulse")} />
      {s.label}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan/90 to-violet/90 text-[0.75rem] font-bold text-ink-850",
        className,
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}

export function ClientBadge({ name, logoUrl, className }: { name: string; logoUrl?: string | null; className?: string }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" className={clsx("size-9 shrink-0 rounded-xl bg-white object-contain p-1", className)} />;
  }
  return (
    <span
      className={clsx(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-gold/40 bg-ink-850 text-[0.72rem] font-bold tracking-wide text-gold",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && <div className="text-fg-3">{icon}</div>}
      <div className="font-serif text-xl text-fg">{title}</div>
      {children && <div className="max-w-md text-sm text-fg-2">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn" | "good" | "bad"; children: ReactNode; className?: string }) {
  const tones = {
    info: "border-cyan/25 bg-cyan/[0.07] text-fg-2",
    warn: "border-gold/30 bg-gold/[0.08] text-fg-2",
    good: "border-good/30 bg-good/[0.08] text-fg-2",
    bad: "border-bad/30 bg-bad/[0.08] text-fg-2",
  };
  return <div className={clsx("rounded-2xl border px-4 py-3 text-sm", tones[tone], className)}>{children}</div>;
}

export function UserStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "text-good bg-good/10 border-good/25",
    invited: "text-cyan bg-cyan/10 border-cyan/25",
    disabled: "text-fg-3 bg-white/5 border-line",
  };
  return <span className={clsx("rounded-full border px-2 py-0.5 text-[0.65rem] font-bold capitalize", map[status] ?? map.disabled)}>{status}</span>;
}
