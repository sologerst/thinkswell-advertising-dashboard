"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { MetricIcon } from "@/components/icons";
import type { CampaignMode, FeeType, GoalType } from "@/lib/db/schema";
import { formatMetric } from "@/lib/format";
import { GOALS, GOAL_PRESETS, METRICS, METRIC_MAP } from "@/lib/metrics/catalog";

/* ------------------------------------------------------------------ */
/* Goal preset + ordered KPI cards                                     */
/* ------------------------------------------------------------------ */

export function GoalPicker({ value, onChange, name = "goal" }: { value: GoalType; onChange?: (g: GoalType) => void; name?: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {GOALS.map((g) => (
        <label
          key={g.goal}
          className={clsx(
            "flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition",
            value === g.goal ? "border-cyan/60 bg-cyan/[0.07] shadow-[0_0_0_3px_rgb(73_203_237/0.12)]" : "border-line hover:border-line-strong",
          )}
        >
          <input type="radio" name={name} value={g.goal} checked={value === g.goal} onChange={() => onChange?.(g.goal)} className="sr-only" />
          <span className="text-xl leading-none">{g.emoji}</span>
          <span>
            <span className="block text-sm font-bold text-fg">{g.label}</span>
            <span className="block text-xs text-fg-3">{g.tagline}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function SetupFields({ initialGoal, initialKpis }: { initialGoal: GoalType; initialKpis: string[] }) {
  const [goal, setGoal] = useState<GoalType>(initialGoal);
  const [kpis, setKpis] = useState<string[]>(initialKpis.length ? initialKpis : GOAL_PRESETS[initialGoal].kpis);
  const available = METRICS.filter((m) => m.key !== "spend" && !kpis.includes(m.key));

  const move = (i: number, d: -1 | 1) =>
    setKpis((list) => {
      const next = [...list];
      const j = i + d;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const changeGoal = (g: GoalType) => {
    // Follow the preset unless the KPI list has been customised.
    const wasPreset = JSON.stringify(kpis) === JSON.stringify(GOAL_PRESETS[goal].kpis);
    setGoal(g);
    if (wasPreset) setKpis(GOAL_PRESETS[g].kpis);
  };

  return (
    <div className="space-y-6">
      <input type="hidden" name="kpis" value={JSON.stringify(kpis)} />
      <div>
        <div className="tw-label">Primary goal</div>
        <p className="mb-3 text-xs text-fg-3">Sets the headline result (tickets, leads, views or clicks) used in day cards, campaign tables and highlights.</p>
        <GoalPicker value={goal} onChange={changeGoal} />
      </div>

      <div>
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <div className="tw-label mb-0">KPI cards</div>
            <p className="text-xs text-fg-3">Shown after Ad spend and Agency fee, in this order.</p>
          </div>
          <button
            type="button"
            onClick={() => setKpis(GOAL_PRESETS[goal].kpis)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg-3 transition hover:text-cyan"
          >
            <RotateCcw className="size-3.5" /> Reset to preset
          </button>
        </div>
        <ol className="space-y-1.5">
          {kpis.map((k, i) => {
            const m = METRIC_MAP[k];
            if (!m) return null;
            return (
              <li key={k} className="flex items-center gap-3 rounded-xl border border-line bg-ink-900/60 px-3 py-2">
                <span className="num w-5 text-xs text-fg-3">{i + 1}</span>
                <MetricIcon name={m.icon} className="size-4 text-fg-3" />
                <span className="flex-1 text-sm font-semibold text-fg">{m.label}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-fg-3 hover:text-fg disabled:opacity-30" aria-label="Move up">
                  <ArrowUp className="size-3.5" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === kpis.length - 1} className="rounded p-1 text-fg-3 hover:text-fg disabled:opacity-30" aria-label="Move down">
                  <ArrowDown className="size-3.5" />
                </button>
                <button type="button" onClick={() => setKpis((l) => l.filter((x) => x !== k))} className="rounded p-1 text-fg-3 hover:text-bad" aria-label={`Remove ${m.label}`}>
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ol>
        {kpis.length < 10 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {available.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setKpis((l) => [...l, m.key])}
                title={m.help}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 py-1 text-xs text-fg-3 transition hover:border-cyan/50 hover:text-fg"
              >
                <Plus className="size-3" /> {m.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Agency fee                                                          */
/* ------------------------------------------------------------------ */

export function FeeFields({ initial }: { initial: { feeType: FeeType; feePercent: number; feeFlatMonthly: number; feeLabel: string } }) {
  const [type, setType] = useState<FeeType>(initial.feeType);
  const [pct, setPct] = useState(String(initial.feePercent || ""));
  const [flat, setFlat] = useState(String(initial.feeFlatMonthly || ""));
  const [label, setLabel] = useState(initial.feeLabel);
  const showPct = type === "percent" || type === "percent_plus_flat";
  const showFlat = type === "flat" || type === "percent_plus_flat";
  const exampleSpend = 10_000;
  const example = (showPct ? exampleSpend * (Number(pct) || 0) / 100 : 0) + (showFlat ? Number(flat) || 0 : 0);

  const options: { v: FeeType; label: string }[] = [
    { v: "none", label: "No fee card" },
    { v: "percent", label: "% of ad spend" },
    { v: "flat", label: "Monthly retainer" },
    { v: "percent_plus_flat", label: "Retainer + %" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {options.map((o) => (
          <label
            key={o.v}
            className={clsx(
              "cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition",
              type === o.v ? "border-gold/60 bg-gold/[0.08] text-fg" : "border-line text-fg-3 hover:border-line-strong hover:text-fg",
            )}
          >
            <input type="radio" name="feeType" value={o.v} checked={type === o.v} onChange={() => setType(o.v)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
      {type !== "none" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="tw-label" htmlFor="feeLabel">
              Card title
            </label>
            <input id="feeLabel" name="feeLabel" value={label} onChange={(e) => setLabel(e.target.value)} className="tw-input" />
          </div>
          {showPct && (
            <div>
              <label className="tw-label" htmlFor="feePercent">
                Percent of ad spend
              </label>
              <div className="relative">
                <input id="feePercent" name="feePercent" type="number" min="0" max="100" step="0.1" value={pct} onChange={(e) => setPct(e.target.value)} className="tw-input pr-8" />
                <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-fg-3">%</span>
              </div>
            </div>
          )}
          {showFlat && (
            <div>
              <label className="tw-label" htmlFor="feeFlatMonthly">
                Monthly retainer
              </label>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-fg-3">$</span>
                <input id="feeFlatMonthly" name="feeFlatMonthly" type="number" min="0" step="1" value={flat} onChange={(e) => setFlat(e.target.value)} className="tw-input pl-7" />
              </div>
            </div>
          )}
        </div>
      )}
      {type === "none" && <input type="hidden" name="feeLabel" value={label} />}
      <p className="text-xs text-fg-3">
        {type === "none"
          ? "Clients will only see the Ad spend card."
          : `Example: in a full month with ${formatMetric(exampleSpend, "currency")} of ad spend, the “${label || "Agency fee"}” card shows ${formatMetric(example, "currency")}. Retainers are spread evenly across the days of each month, so any date range shows the right share.`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ad accounts & campaign visibility                                   */
/* ------------------------------------------------------------------ */

type AccountOpt = { id: string; name: string; source: string; usedBy: string[] };
type CampaignOpt = { id: string; name: string; status: string | null; accountId: string };

export function AccessFields({
  accounts,
  campaigns,
  initial,
}: {
  accounts: AccountOpt[];
  campaigns: CampaignOpt[];
  initial: { accounts: string[]; campaignMode: CampaignMode; campaigns: string[]; campaignNameFilter: string };
}) {
  const [selAccounts, setSelAccounts] = useState<string[]>(initial.accounts);
  const [mode, setMode] = useState<CampaignMode>(initial.campaignMode);
  const [selCampaigns, setSelCampaigns] = useState<string[]>(initial.campaigns);
  const [filter, setFilter] = useState(initial.campaignNameFilter);
  const [q, setQ] = useState("");

  const visibleCampaigns = useMemo(
    () => campaigns.filter((c) => selAccounts.includes(c.accountId) && (!q || c.name.toLowerCase().includes(q.toLowerCase()))),
    [campaigns, selAccounts, q],
  );
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="space-y-6">
      <div>
        <div className="tw-label">Meta ad accounts</div>
        <p className="mb-3 text-xs text-fg-3">Everything this client sees comes from these accounts (Facebook + Instagram placements).</p>
        {accounts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-4 text-sm text-fg-3">No ad accounts yet. Run a sync from the Data page to pull them in from Windsor.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {accounts.map((a) => {
              const on = selAccounts.includes(a.id);
              return (
                <label
                  key={a.id}
                  className={clsx(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition",
                    on ? "border-cyan/60 bg-cyan/[0.06]" : "border-line hover:border-line-strong",
                  )}
                >
                  <input type="checkbox" name="accounts" value={a.id} checked={on} onChange={() => setSelAccounts((l) => toggle(l, a.id))} className="mt-0.5 size-4 accent-[#49cbed]" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-fg">{a.name}</span>
                    <span className="block text-xs text-fg-3">
                      act_{a.id}
                      {a.source === "demo" && " · demo"}
                      {a.usedBy.length > 0 && ` · also used by ${a.usedBy.join(", ")}`}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="tw-label">Which campaigns can they see?</div>
        <div className="mb-3 grid gap-2 md:grid-cols-3">
          {(
            [
              { v: "all", label: "All campaigns", sub: "Everything in the selected accounts" },
              { v: "include", label: "Only these…", sub: "Just the campaigns you tick" },
              { v: "exclude", label: "All except…", sub: "Hide the campaigns you tick" },
            ] as const
          ).map((o) => (
            <label
              key={o.v}
              className={clsx(
                "cursor-pointer rounded-xl border p-3 transition",
                mode === o.v ? "border-cyan/60 bg-cyan/[0.06]" : "border-line hover:border-line-strong",
              )}
            >
              <input type="radio" name="campaignMode" value={o.v} checked={mode === o.v} onChange={() => setMode(o.v)} className="sr-only" />
              <span className="block text-sm font-bold text-fg">{o.label}</span>
              <span className="block text-xs text-fg-3">{o.sub}</span>
            </label>
          ))}
        </div>

        {mode !== "all" && (
          <div className="rounded-2xl border border-line bg-ink-900/50 p-3">
            <label className="relative mb-2 block">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-3" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter campaigns" className="tw-input py-2 pl-9 text-sm" />
            </label>
            <div className="scrollbar-thin max-h-72 space-y-0.5 overflow-y-auto">
              {visibleCampaigns.length === 0 && <p className="p-3 text-sm text-fg-3">Select an ad account to pick campaigns.</p>}
              {visibleCampaigns.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition hover:bg-white/5">
                  <input type="checkbox" checked={selCampaigns.includes(c.id)} onChange={() => setSelCampaigns((l) => toggle(l, c.id))} className="size-4 accent-[#49cbed]" />
                  <span className="flex-1 truncate text-fg-2">{c.name}</span>
                  {c.status && <span className="text-[0.65rem] text-fg-3 uppercase">{c.status.toLowerCase()}</span>}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-fg-3">{selCampaigns.filter((id) => campaigns.some((c) => c.id === id && selAccounts.includes(c.accountId))).length} selected</p>
          </div>
        )}
        {/* Only submit ticked campaigns that belong to a selected account. */}
        {mode !== "all" &&
          selCampaigns
            .filter((id) => campaigns.some((c) => c.id === id && selAccounts.includes(c.accountId)))
            .map((id) => <input key={id} type="hidden" name="campaigns" value={id} />)}
      </div>

      <div>
        <label className="tw-label" htmlFor="campaignNameFilter">
          Campaign name contains <span className="font-normal text-fg-3">(optional)</span>
        </label>
        <input
          id="campaignNameFilter"
          name="campaignNameFilter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="e.g. [NEON MESA]"
          className="tw-input"
        />
        <p className="mt-1.5 text-xs text-fg-3">Handy when several clients share one ad account: tag campaign names and filter on the tag.</p>
      </div>
    </div>
  );
}
