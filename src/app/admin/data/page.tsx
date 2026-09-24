import { CircleAlert, CircleCheck, Clock, Database, PlugZap } from "lucide-react";
import type { Metadata } from "next";
import { runSync, testWindsor } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin/action-form";
import { Card, SectionTitle } from "@/components/ui";
import { accountSpend, accountsWithUsage, recentSyncRuns } from "@/lib/admin-data";
import { fmtRange } from "@/lib/dates";
import { formatMetric, timeAgo } from "@/lib/format";
import { isLiveMode, windsorKey } from "@/lib/windsor/client";

export const metadata: Metadata = { title: "Data" };
// Backfills can take a while on big accounts.
export const maxDuration = 300;

export default async function DataPage() {
  const live = isLiveMode();
  const key = windsorKey();
  const [accounts, spend, runs] = await Promise.all([accountsWithUsage(), accountSpend(30), recentSyncRuns(15)]);

  return (
    <>
      <div className="mb-8 animate-rise">
        <div className="eyebrow mb-2 text-cyan!">Admin console</div>
        <h1 className="font-serif text-[2.6rem] leading-[1.05] text-fg">Data connection</h1>
        <p className="mt-2 max-w-2xl text-sm text-fg-2">
          Meta (Facebook + Instagram) results flow in from Windsor.ai into our database on a schedule, so client dashboards load instantly and never hit Windsor directly.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.3fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className={`inline-flex size-12 shrink-0 items-center justify-center rounded-2xl ${live ? "bg-good/15 text-good" : "bg-gold/15 text-gold"}`}>
              {live ? <PlugZap className="size-6" /> : <Database className="size-6" />}
            </span>
            <div>
              <div className="font-serif text-2xl text-fg">{live ? "Windsor.ai is connected" : "Running on demo data"}</div>
              <p className="mt-1 text-sm text-fg-2">
                {live ? (
                  <>
                    API key <code className="text-fg">••••{key!.slice(-4)}</code> · Facebook connector
                    {process.env.WINDSOR_ATTRIBUTION_WINDOW ? ` · attribution ${process.env.WINDSOR_ATTRIBUTION_WINDOW}` : " · Meta default attribution"}
                  </>
                ) : (
                  <>
                    Set <code className="text-fg">WINDSOR_API_KEY</code> in your environment (Vercel → Settings → Environment Variables), redeploy, then run a 90-day backfill below.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {(
              [
                [7, "Sync last 7 days", "Quick refresh. Picks up today's spend and late conversions."],
                [30, "Sync last 30 days", "Meta keeps updating conversions for up to ~28 days."],
                [90, "Backfill 90 days", "Use once after connecting a new ad account."],
              ] as const
            ).map(([days, label, sub]) => (
              <div key={days} className="rounded-2xl border border-line bg-ink-900/40 p-4">
                <ActionForm action={runSync} submitLabel={label} pendingLabel="Syncing…" variant={days === 7 ? "primary" : "secondary"} footerLeft={<span className="text-xs text-fg-3">{sub}</span>}>
                  <input type="hidden" name="days" value={days} />
                </ActionForm>
              </div>
            ))}
            {live && (
              <div className="rounded-2xl border border-line bg-ink-900/40 p-4">
                <ActionForm action={testWindsor} submitLabel="Test connection" pendingLabel="Checking…" variant="secondary" footerLeft={<span className="text-xs text-fg-3">Lists the Meta accounts Windsor can see.</span>} />
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-line p-4 text-xs leading-relaxed text-fg-3">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-fg-2">
              <Clock className="size-3.5" /> Automatic sync
            </div>
            Vercel Cron calls <code className="text-fg-2">/api/cron/sync</code> on the schedule in <code className="text-fg-2">vercel.json</code> and re-pulls the last{" "}
            {process.env.SYNC_LOOKBACK_DAYS ?? 7} days each time (set <code className="text-fg-2">SYNC_LOOKBACK_DAYS</code> to change it).
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <SectionTitle eyebrow="Meta" title="Ad accounts" className="mb-4" />
            {accounts.length === 0 ? (
              <p className="text-sm text-fg-3">No ad accounts yet. Run a sync to discover the accounts connected in Windsor.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-[0.7rem] tracking-wider text-fg-3 uppercase">
                      <th className="pb-3 font-bold">Account</th>
                      <th className="pb-3 font-bold">Clients</th>
                      <th className="pb-3 text-right font-bold">Spend · 30d</th>
                      <th className="pb-3 text-right font-bold">Synced</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.id} className="border-t border-line">
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-fg">{a.name}</div>
                          <div className="text-xs text-fg-3">
                            act_{a.id}
                            {a.source === "demo" && " · demo"}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-xs">{a.usedBy.length ? <span className="text-fg-2">{a.usedBy.join(", ")}</span> : <span className="text-gold">Unassigned</span>}</td>
                        <td className="num py-3 text-right text-fg-2">{formatMetric(spend.get(a.id)?.spend ?? 0, "currency")}</td>
                        <td className="py-3 text-right text-xs text-fg-3">{timeAgo(a.lastSyncedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionTitle eyebrow="Log" title="Recent syncs" className="mb-4" />
            {runs.length === 0 ? (
              <p className="text-sm text-fg-3">Nothing has synced yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {runs.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 py-3 text-sm">
                    {r.status === "success" ? (
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-good" />
                    ) : r.status === "error" ? (
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-bad" />
                    ) : (
                      <Clock className="mt-0.5 size-4 shrink-0 animate-pulse text-cyan" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-fg">
                        {r.source === "demo" ? "Demo refresh" : "Windsor sync"} · {fmtRange(r.dateFrom, r.dateTo)}
                        {r.status === "success" && <span className="text-fg-3"> · {r.rows.toLocaleString()} rows</span>}
                      </div>
                      {r.error && <div className={`mt-0.5 text-xs break-words ${r.status === "error" ? "text-bad" : "text-gold"}`}>{r.error}</div>}
                      <div className="mt-0.5 text-xs text-fg-3">
                        {timeAgo(r.startedAt)} · by {r.triggeredBy ?? "system"}
                        {r.finishedAt && ` · ${Math.max(1, Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000))}s`}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
