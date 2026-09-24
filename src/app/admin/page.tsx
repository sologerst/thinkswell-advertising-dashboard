import { ArrowUpRight, Link2, Plus, Settings2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Sparkline } from "@/components/charts/sparkline";
import { ButtonLink, Card, ClientBadge, EmptyState, Notice } from "@/components/ui";
import { accountsWithUsage, clientSnapshots } from "@/lib/admin-data";
import { formatMetric } from "@/lib/format";
import { GOAL_PRESETS } from "@/lib/metrics/catalog";
import { isLiveMode } from "@/lib/windsor/client";

export const metadata: Metadata = { title: "Clients" };

export default async function AdminHome() {
  const [snaps, accounts] = await Promise.all([clientSnapshots(), accountsWithUsage()]);
  const unassigned = accounts.filter((a) => a.usedBy.length === 0);
  const totalSpend = snaps.reduce((s, c) => s + c.spend, 0);
  const totalFees = snaps.reduce((s, c) => s + (c.fee ?? 0), 0);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="animate-rise">
          <div className="eyebrow mb-2 text-cyan!">Admin console</div>
          <h1 className="font-serif text-[2.6rem] leading-[1.05] text-fg">Clients</h1>
          <p className="mt-2 text-sm text-fg-2">
            Last 7 days across {snaps.length} client{snaps.length === 1 ? "" : "s"}:{" "}
            <span className="font-semibold text-fg">{formatMetric(totalSpend, "currency")}</span> in ad spend
            {totalFees > 0 && (
              <>
                , <span className="font-semibold text-gold">{formatMetric(totalFees, "currency")}</span> in agency fees
              </>
            )}
            .
          </p>
        </div>
        <ButtonLink href="/admin/clients/new" variant="gold">
          <Plus className="size-4" /> New client
        </ButtonLink>
      </div>

      {!isLiveMode() && (
        <Notice tone="warn" className="mb-6">
          <strong className="text-gold">You&apos;re looking at demo data.</strong> Add your <code className="text-fg">WINDSOR_API_KEY</code> and run a sync from{" "}
          <Link href="/admin/data" className="font-semibold text-fg underline underline-offset-2">
            Data
          </Link>{" "}
          to pull in real Meta accounts.
        </Notice>
      )}

      {unassigned.length > 0 && (
        <Notice tone="info" className="mb-6">
          <Link2 className="mr-1.5 inline size-4 align-[-3px] text-cyan" />
          {unassigned.length} ad account{unassigned.length === 1 ? " isn't" : "s aren't"} linked to a client yet: {unassigned.map((a) => a.name).join(", ")}.
        </Notice>
      )}

      {snaps.length === 0 ? (
        <Card>
          <EmptyState title="No clients yet">
            Create your first client, link their Meta ad account, and invite their team.
            <div className="mt-5">
              <ButtonLink href="/admin/clients/new" variant="gold">
                <Plus className="size-4" /> New client
              </ButtonLink>
            </div>
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {snaps.map((s, i) => {
            const preset = GOAL_PRESETS[s.client.goal];
            return (
              <Card key={s.client.id} className="animate-rise flex flex-col p-5 transition hover:border-line-strong" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-start gap-3">
                  <ClientBadge name={s.client.name} logoUrl={s.client.logoUrl} className="size-11! rounded-2xl!" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-serif text-xl text-fg">{s.client.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-3">
                      <span>
                        {preset.emoji} {preset.label}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" /> {s.members}
                      </span>
                      <span>
                        {s.accounts} account{s.accounts === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <Mini label="Spend · 7d" value={formatMetric(s.spend, "currency", { compact: true })} />
                  <Mini label={s.resultLabel} value={formatMetric(s.result, s.resultFormat, { compact: true })} />
                  <Mini label={s.costLabel} value={formatMetric(s.cost, "currency")} />
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <span className="text-xs text-fg-3">{s.fee !== null ? <>Fee {formatMetric(s.fee, "currency")}</> : "No fee card"}</span>
                  <Sparkline values={s.spark} color="#49cbed" width={140} height={34} />
                </div>

                <div className="mt-5 flex gap-2 border-t border-line pt-4">
                  <ButtonLink href={`/c/${s.client.slug}`} variant="secondary" className="flex-1 py-2">
                    Open dashboard <ArrowUpRight className="size-4" />
                  </ButtonLink>
                  <ButtonLink href={`/admin/clients/${s.client.id}`} variant="ghost" className="py-2">
                    <Settings2 className="size-4" /> Setup
                  </ButtonLink>
                </div>
                {s.accounts === 0 && <p className="mt-3 text-xs text-gold">No ad accounts linked. The client will see an empty dashboard.</p>}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-ink-900/50 px-3 py-2">
      <div className="truncate text-[0.65rem] font-semibold tracking-wide text-fg-3 uppercase">{label}</div>
      <div className="num mt-0.5 text-base font-semibold text-fg">{value}</div>
    </div>
  );
}
