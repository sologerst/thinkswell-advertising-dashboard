import type { ReactNode } from "react";
import { BrandLockup } from "@/components/brand";

function FloatCard({ label, value, delta, color, className, style }: { label: string; value: string; delta: string; color: string; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`tw-card animate-float w-52 p-4 backdrop-blur ${className ?? ""}`} style={style}>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ background: color }} />
        <span className="eyebrow">{label}</span>
      </div>
      <div className="mt-2 text-[1.7rem] leading-none font-semibold text-fg">{value}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-good">▲ {delta}</span>
        <svg viewBox="0 0 80 24" className="h-6 w-20" aria-hidden>
          <path d="M0 20 L12 16 L24 18 L36 11 L48 13 L60 6 L72 8 L80 2" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line bg-ink-850/70 lg:block">
        <div className="absolute -top-40 -left-32 size-[520px] rounded-full bg-cyan/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 size-[480px] rounded-full bg-purple/40 blur-[130px]" />
        <div className="absolute -bottom-40 left-1/4 size-[420px] rounded-full bg-gold/10 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <BrandLockup />
          <div className="max-w-lg">
            <div className="eyebrow mb-4 text-gold!">Nashville · Paid media</div>
            <h2 className="font-serif text-[3.4rem] leading-[1.02] text-fg">
              Your campaigns,
              <br />
              <em className="text-cyan">live</em> and in color.
            </h2>
            <p className="mt-5 max-w-md text-fg-2">
              Real-time Facebook &amp; Instagram results from the Thinkswell team: tickets, leads, reach and every dollar in between.
            </p>
          </div>
          <div className="relative h-44">
            <FloatCard label="Tickets sold" value="1,284" delta="18.2%" color="#49cbed" className="absolute left-0 top-4" />
            <FloatCard label="ROAS" value="6.21x" delta="0.8x" color="#f7bd45" className="absolute left-60 top-0" style={{ animationDelay: "-2s" }} />
            <FloatCard label="Leads" value="342" delta="24.0%" color="#a47cff" className="absolute left-[30rem] top-10 hidden xl:block" style={{ animationDelay: "-4s" }} />
          </div>
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[400px] animate-rise">
          <div className="mb-10 lg:hidden">
            <BrandLockup />
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
