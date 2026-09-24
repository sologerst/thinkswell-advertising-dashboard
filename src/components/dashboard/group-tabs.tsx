import clsx from "clsx";
import Link from "next/link";
import type { CampaignGroup, GoalType } from "@/lib/db/schema";
import { GOAL_PRESETS } from "@/lib/metrics/catalog";

/** Campaign-group switcher: "All campaigns" plus one pill per group the viewer can see. */
export function GroupTabs({
  groups,
  active,
  clientGoal,
  hrefFor,
  allLabel = "All campaigns",
}: {
  groups: Pick<CampaignGroup, "id" | "name" | "goal">[];
  active: string | null;
  clientGoal: GoalType;
  hrefFor: (groupId: string | null) => string;
  allLabel?: string;
}) {
  if (groups.length === 0) return null;
  const pill = (id: string | null, label: string, goal: GoalType | null) => {
    const on = active === id;
    return (
      <Link
        key={id ?? "all"}
        href={hrefFor(id)}
        scroll={false}
        aria-current={on ? "page" : undefined}
        className={clsx(
          "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
          on ? "border-cyan/60 bg-cyan/10 text-fg shadow-[0_0_0_3px_rgb(73_203_237/0.1)]" : "border-line text-fg-3 hover:border-line-strong hover:text-fg",
        )}
      >
        {goal && goal !== clientGoal && <span aria-hidden>{GOAL_PRESETS[goal].emoji}</span>}
        {label}
      </Link>
    );
  };
  return (
    <nav aria-label="Campaign groups" className="scrollbar-thin -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1 animate-rise">
      {pill(null, allLabel, null)}
      {groups.map((g) => pill(g.id, g.name, g.goal))}
    </nav>
  );
}
