"use client";

import { useState } from "react";
import { createClient } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin/action-form";
import { GoalPicker } from "@/components/admin/setup-fields";
import { Card } from "@/components/ui";
import type { GoalType } from "@/lib/db/schema";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);

export function NewClientForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const [goal, setGoal] = useState<GoalType>("sales");
  const effectiveSlug = touched ? slug : slugify(name);

  return (
    <Card className="p-6">
      <ActionForm action={createClient} submitLabel="Create client" pendingLabel="Creating…" variant="gold">
        <div className="space-y-5">
          <div>
            <label htmlFor="name" className="tw-label">
              Client name
            </label>
            <input id="name" name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Neon Mesa Music Hall" className="tw-input" />
          </div>
          <div>
            <label htmlFor="slug" className="tw-label">
              Dashboard URL
            </label>
            <div className="flex items-center rounded-[0.875rem] border border-line-strong bg-ink-900 focus-within:border-cyan/70">
              <span className="pl-3 text-sm text-fg-3">/c/</span>
              <input
                id="slug"
                name="slug"
                value={effectiveSlug}
                onChange={(e) => {
                  setTouched(true);
                  setSlug(e.target.value);
                }}
                className="w-full bg-transparent px-1 py-[0.7rem] text-[0.95rem] text-fg outline-none"
              />
            </div>
          </div>
          <div>
            <div className="tw-label">Primary goal</div>
            <GoalPicker value={goal} onChange={setGoal} />
          </div>
        </div>
      </ActionForm>
    </Card>
  );
}
