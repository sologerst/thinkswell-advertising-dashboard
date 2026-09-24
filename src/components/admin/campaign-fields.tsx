"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, Layers, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { GoalType } from "@/lib/db/schema";
import { GOALS, GOAL_PRESETS } from "@/lib/metrics/catalog";

type GroupDraft = { id?: string; key: string; name: string; goal: GoalType | "" };

let seq = 0;
const newKey = () => `new-${++seq}`;

/** Add, rename, re-goal, reorder and delete a client's campaign groups. */
export function GroupsEditor({ initial, clientGoal }: { initial: { id: string; name: string; goal: GoalType | null }[]; clientGoal: GoalType }) {
  const [groups, setGroups] = useState<GroupDraft[]>(initial.map((g) => ({ id: g.id, key: g.id, name: g.name, goal: g.goal ?? "" })));
  const update = (key: string, patch: Partial<GroupDraft>) => setGroups((l) => l.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  const move = (i: number, d: -1 | 1) =>
    setGroups((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const next = [...l];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  return (
    <div>
      <input type="hidden" name="groups" value={JSON.stringify(groups.map(({ id, name, goal }) => ({ id, name, goal: goal || null })))} />
      {groups.length === 0 && (
        <p className="mb-3 rounded-xl border border-dashed border-line p-4 text-sm text-fg-3">
          No groups yet. Groups bundle campaigns (e.g. one event, tour or promo) into their own tab on the client&apos;s dashboard.
        </p>
      )}
      <ol className="space-y-2">
        {groups.map((g, i) => (
          <li key={g.key} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-ink-900/60 p-2 pl-3">
            <Layers className="size-4 shrink-0 text-gold" />
            <input
              value={g.name}
              onChange={(e) => update(g.key, { name: e.target.value })}
              placeholder="Group name, e.g. Halloween Bash 2026"
              aria-label="Group name"
              className="tw-input min-w-48 flex-1 py-2 text-sm"
            />
            <select value={g.goal} onChange={(e) => update(g.key, { goal: e.target.value as GoalType | "" })} aria-label="Group goal" className="tw-input w-auto py-2 text-sm">
              <option value="">Goal: same as client ({GOAL_PRESETS[clientGoal].label})</option>
              {GOALS.map((p) => (
                <option key={p.goal} value={p.goal}>
                  Goal: {p.emoji} {p.label}
                </option>
              ))}
            </select>
            <div className="flex items-center">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1.5 text-fg-3 hover:text-fg disabled:opacity-30" aria-label="Move up">
                <ArrowUp className="size-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === groups.length - 1} className="rounded p-1.5 text-fg-3 hover:text-fg disabled:opacity-30" aria-label="Move down">
                <ArrowDown className="size-3.5" />
              </button>
              <button type="button" onClick={() => setGroups((l) => l.filter((x) => x.key !== g.key))} className="rounded p-1.5 text-fg-3 hover:text-bad" aria-label={`Delete ${g.name || "group"}`}>
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => setGroups((l) => [...l, { key: newKey(), name: "", goal: "" }])}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 py-1.5 text-xs font-semibold text-fg-3 transition hover:border-cyan/50 hover:text-fg"
      >
        <Plus className="size-3.5" /> Add group
      </button>
      <p className="mt-3 text-xs text-fg-3">Deleting a group moves its campaigns back to “Other campaigns” and removes it from anyone limited to that group.</p>
    </div>
  );
}

type CampaignOpt = { id: string; name: string; status: string | null; displayName: string; groupId: string; goal: GoalType | "" };

/** Friendly name, group and goal override for each campaign the client can see. */
export function CampaignSettingsEditor({
  campaigns,
  groups,
  clientGoal,
}: {
  campaigns: CampaignOpt[];
  groups: { id: string; name: string; goal: GoalType | null }[];
  clientGoal: GoalType;
}) {
  const [rows, setRows] = useState(campaigns);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "ungrouped" | "active">("all");
  const update = (id: string, patch: Partial<CampaignOpt>) => setRows((l) => l.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const groupGoal = (gid: string) => groups.find((g) => g.id === gid)?.goal ?? null;

  const visible = useMemo(
    () =>
      rows.filter((r) => {
        if (q && !`${r.name} ${r.displayName}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (filter === "ungrouped" && r.groupId) return false;
        if (filter === "active" && r.status?.toUpperCase() !== "ACTIVE") return false;
        return true;
      }),
    [rows, q, filter],
  );

  if (campaigns.length === 0) {
    return <p className="rounded-xl border border-dashed border-line p-4 text-sm text-fg-3">No campaigns yet. Link an ad account under Data access and run a sync.</p>;
  }

  return (
    <div>
      <input
        type="hidden"
        name="settings"
        value={JSON.stringify(rows.map((r) => ({ campaignId: r.id, displayName: r.displayName, groupId: r.groupId || null, goal: r.goal || null })))}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a campaign" className="tw-input py-2 pl-9 text-sm" />
        </label>
        <div className="inline-flex rounded-xl border border-line-strong p-1">
          {(
            [
              ["all", "All"],
              ["active", "Live"],
              ["ungrouped", "Ungrouped"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={clsx("rounded-lg px-3 py-1 text-xs font-bold transition", filter === k ? "bg-white/10 text-fg" : "text-fg-3 hover:text-fg")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="scrollbar-thin max-h-[560px] overflow-auto rounded-2xl border border-line">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="sticky top-0 z-10 bg-ink-750">
            <tr className="text-left text-[0.7rem] tracking-wider text-fg-3 uppercase">
              <th className="px-3 py-2.5 font-bold">Campaign in Ads Manager</th>
              <th className="px-3 py-2.5 font-bold">Name clients see</th>
              <th className="px-3 py-2.5 font-bold">Group</th>
              <th className="px-3 py-2.5 font-bold">Measured on</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const inherited = groupGoal(r.groupId) ?? clientGoal;
              return (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-3 py-2.5">
                    <div className="max-w-[260px] truncate font-semibold text-fg" title={r.name}>
                      {r.name}
                    </div>
                    <div className="text-[0.7rem] text-fg-3 uppercase">{r.status?.toLowerCase() ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={r.displayName}
                      onChange={(e) => update(r.id, { displayName: e.target.value })}
                      placeholder="Same as Ads Manager"
                      aria-label={`Client-facing name for ${r.name}`}
                      className="tw-input py-1.5 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select value={r.groupId} onChange={(e) => update(r.id, { groupId: e.target.value })} aria-label={`Group for ${r.name}`} className="tw-input py-1.5 text-sm">
                      <option value="">No group</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select value={r.goal} onChange={(e) => update(r.id, { goal: e.target.value as GoalType | "" })} aria-label={`Goal for ${r.name}`} className="tw-input py-1.5 text-sm">
                      <option value="">
                        {GOAL_PRESETS[inherited].emoji} {GOAL_PRESETS[inherited].label} (inherited)
                      </option>
                      {GOALS.map((p) => (
                        <option key={p.goal} value={p.goal}>
                          {p.emoji} {p.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && <p className="p-4 text-center text-sm text-fg-3">No campaigns match.</p>}
      </div>
      <p className="mt-2 text-xs text-fg-3">
        {rows.length} campaign{rows.length === 1 ? "" : "s"} · Goals decide which result (tickets, leads, ThruPlays, clicks) a campaign is judged on. They inherit from the group, then the client.
      </p>
    </div>
  );
}

/** "All campaigns" vs "only these groups" for one person. */
export function MemberAccessFields({ groups, restricted, selected }: { groups: { id: string; name: string }[]; restricted: boolean; selected: string[] }) {
  const [mode, setMode] = useState<"all" | "groups">(restricted ? "groups" : "all");
  const [picked, setPicked] = useState<string[]>(selected);
  return (
    <div className="space-y-2">
      <div className="inline-flex rounded-xl border border-line-strong p-1">
        {(
          [
            ["all", "All campaigns"],
            ["groups", "Only certain groups"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className={clsx("cursor-pointer rounded-lg px-3 py-1 text-xs font-bold transition", mode === k ? "bg-white/10 text-fg" : "text-fg-3 hover:text-fg")}>
            <input type="radio" name="access" value={k} checked={mode === k} onChange={() => setMode(k)} className="sr-only" />
            {label}
          </label>
        ))}
      </div>
      {mode === "groups" && (
        <div className="flex flex-wrap gap-1.5">
          {groups.map((g) => {
            const on = picked.includes(g.id);
            return (
              <label
                key={g.id}
                className={clsx(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                  on ? "border-gold/60 bg-gold/10 text-fg" : "border-line text-fg-3 hover:text-fg",
                )}
              >
                <input
                  type="checkbox"
                  name="groups"
                  value={g.id}
                  checked={on}
                  onChange={() => setPicked((l) => (on ? l.filter((x) => x !== g.id) : [...l, g.id]))}
                  className="sr-only"
                />
                <Layers className="size-3" /> {g.name}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
