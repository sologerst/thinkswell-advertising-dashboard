"use client";

import clsx from "clsx";
import { Check, CircleAlert, Copy, LoaderCircle, Mail } from "lucide-react";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import type { ActionState } from "@/app/actions/admin";
import { Button } from "@/components/ui";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * A form bound to a server action, with pending state and inline success/error/link feedback.
 * Submits via a transition (not the `action` prop) so fields keep their values when the
 * server returns a validation error.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  pendingLabel = "Saving…",
  variant = "primary",
  className,
  footerLeft,
  clearOnSuccess,
}: {
  action: Action;
  children?: ReactNode;
  submitLabel?: string;
  pendingLabel?: string;
  variant?: "primary" | "gold" | "secondary";
  className?: string;
  footerLeft?: ReactNode;
  clearOnSuccess?: boolean;
}) {
  const [state, setState] = useState<ActionState>(undefined);
  const [pending, start] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        start(async () => {
          const result = await action(state, data);
          setState(result);
          if (result?.ok && clearOnSuccess) form.reset();
        });
      }}
    >
      {children}
      <div className={clsx("flex flex-wrap items-center justify-between gap-3", children != null && "mt-5")}>
        <div className="min-w-0 flex-1">{footerLeft}</div>
        <Button type="submit" variant={variant} disabled={pending}>
          {pending && <LoaderCircle className="size-4 animate-spin" />}
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>
      <ActionResult state={state} />
    </form>
  );
}

export function ActionResult({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <div className="mt-4 space-y-2" role="status">
      {state.error && (
        <p className="flex items-start gap-2 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2.5 text-sm text-fg-2">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-bad" /> {state.error}
        </p>
      )}
      {state.ok && (
        <p className="flex items-start gap-2 rounded-xl border border-good/30 bg-good/10 px-3 py-2.5 text-sm text-fg-2">
          {state.emailed ? <Mail className="mt-0.5 size-4 shrink-0 text-good" /> : <Check className="mt-0.5 size-4 shrink-0 text-good" />} {state.ok}
        </p>
      )}
      {state.link && <CopyLink link={state.link} />}
    </div>
  );
}

export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-cyan/30 bg-cyan/[0.06] p-1.5 pl-3">
      <code className="min-w-0 flex-1 truncate text-xs text-cyan">{link}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
        className={clsx(
          "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition",
          copied ? "bg-good text-ink-850" : "bg-cyan text-ink-850 hover:bg-[#6fd8f3]",
        )}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** Small inline button form (e.g. "Get link") that shows its result underneath. */
export function InlineAction({ action, hidden, label, icon }: { action: Action; hidden: Record<string, string>; label: string; icon?: ReactNode }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <div>
      <form action={formAction} className="inline">
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-semibold text-fg-2 transition hover:border-cyan/50 hover:text-fg disabled:opacity-50"
        >
          {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : icon}
          {label}
        </button>
      </form>
      {state && (
        <div className="mt-2 max-w-md">
          <ActionResult state={state} />
        </div>
      )}
    </div>
  );
}
