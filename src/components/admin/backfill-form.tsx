"use client";

import clsx from "clsx";
import { Check, CircleAlert, History, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { syncBackfillWindow, type BackfillResult } from "@/app/actions/admin";
import { Button } from "@/components/ui";
import { BACKFILL_CHUNK_DAYS, META_HISTORY_MONTHS, backfillWindows, type BackfillWindow } from "@/lib/backfill";
import { fmtDayYear, fmtRange, isISODate } from "@/lib/dates";
import { formatMetric } from "@/lib/format";

type Step = BackfillWindow & { status: "waiting" | "running" | "done" | "error"; rows?: number; warnings?: number; error?: string };

/**
 * Pulls older history window by window (newest first), one server action call
 * per window so none of them runs into the function time limit. Stops on the
 * first error; "Resume" picks up from there.
 */
export function BackfillForm({
  today,
  earliest,
  defaults,
  oldest,
}: {
  today: string;
  /** Oldest date Meta still has results for. */
  earliest: string;
  defaults: BackfillWindow;
  /** Oldest date already synced, if any. */
  oldest: string | null;
}) {
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const stopRequested = useRef(false);

  // Leaving mid-run would abandon the remaining windows.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  const invalid =
    !isISODate(from) || !isISODate(to)
      ? "Pick both dates."
      : from > to
        ? "The start date is after the end date."
        : from < earliest
          ? `Meta only goes back to ${fmtDayYear(earliest)}.`
          : to > today
            ? "The end date can't be in the future."
            : null;
  const plan = invalid ? [] : backfillWindows(from, to);
  const done = steps.filter((s) => s.status === "done");
  const rows = done.reduce((n, s) => n + (s.rows ?? 0), 0);
  const finished = steps.length > 0 && done.length === steps.length;
  const canResume = steps.length > 0 && !finished && !running;

  const update = (i: number, patch: Partial<Step>) => setSteps((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  async function run(list: Step[]) {
    setSteps(list);
    setRunning(true);
    stopRequested.current = false;
    for (let i = 0; i < list.length; i++) {
      if (list[i]!.status === "done") continue;
      if (stopRequested.current) break;
      update(i, { status: "running", error: undefined });
      let r: BackfillResult;
      try {
        r = await syncBackfillWindow(list[i]!.from, list[i]!.to);
      } catch {
        r = { error: "Lost touch with the server. It may still finish this window in the background; check the log below, then resume." };
      }
      if ("error" in r) {
        update(i, { status: "error", error: r.error });
        break;
      }
      update(i, { status: "done", rows: r.rows, warnings: r.warnings });
    }
    setRunning(false);
    setStopping(false);
  }

  const setDate = (set: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    set(e.target.value);
    setSteps([]);
  };

  return (
    <div className="rounded-2xl border border-line bg-ink-900/40 p-4">
      <div className="flex items-start gap-2.5">
        <History className="mt-0.5 size-4 shrink-0 text-cyan" />
        <div>
          <div className="text-sm font-semibold text-fg">Backfill history</div>
          <p className="mt-0.5 text-xs text-fg-3">
            Pulls older results {BACKFILL_CHUNK_DAYS} days at a time, newest first. Meta keeps {META_HISTORY_MONTHS} months (back to {fmtDayYear(earliest)}).
            {oldest && <> Synced data currently starts {fmtDayYear(oldest)}.</>}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-fg-3">
          <span className="mb-1 block">From</span>
          <input type="date" value={from} min={earliest} max={to || today} disabled={running} onChange={setDate(setFrom)} className="tw-input px-2 py-1.5 text-xs" />
        </label>
        <label className="text-xs font-semibold text-fg-3">
          <span className="mb-1 block">To</span>
          <input type="date" value={to} min={from || earliest} max={today} disabled={running} onChange={setDate(setTo)} className="tw-input px-2 py-1.5 text-xs" />
        </label>
        <div className="ml-auto">
          {running ? (
            <Button
              type="button"
              variant="secondary"
              disabled={stopping}
              onClick={() => {
                stopRequested.current = true;
                setStopping(true);
              }}
            >
              {stopping ? "Stopping…" : "Stop"}
            </Button>
          ) : canResume ? (
            <Button type="button" onClick={() => run(steps)}>
              Resume
            </Button>
          ) : (
            <Button type="button" variant="secondary" disabled={Boolean(invalid)} onClick={() => run(plan.map((w) => ({ ...w, status: "waiting" })))}>
              {finished ? "Run again" : "Start backfill"}
            </Button>
          )}
        </div>
      </div>

      {invalid ? (
        <p className="mt-2 text-xs text-bad">{invalid}</p>
      ) : (
        steps.length === 0 && (
          <p className="mt-2 text-xs text-fg-3">
            {plan.length} {plan.length === 1 ? "window" : "windows"}, roughly a minute each. Keep this page open while it runs.
          </p>
        )
      )}

      {steps.length > 0 && (
        <div className="mt-4" role="status" aria-live="polite">
          <div className="mb-2 flex items-center justify-between text-xs text-fg-3">
            <span>
              {done.length} of {steps.length} windows · {formatMetric(rows, "number")} rows
            </span>
            {running && <span>{stopping ? "Stopping after this window…" : "Keep this page open"}</span>}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-cyan transition-[width] duration-500" style={{ width: `${(done.length / steps.length) * 100}%` }} />
          </div>
          <ul className="mt-3 space-y-1.5">
            {steps.map((s) => (
              <li key={s.from} className="text-xs">
                <div className="flex items-center gap-2">
                  {s.status === "done" ? (
                    <Check className="size-3.5 shrink-0 text-good" />
                  ) : s.status === "running" ? (
                    <LoaderCircle className="size-3.5 shrink-0 animate-spin text-cyan" />
                  ) : s.status === "error" ? (
                    <CircleAlert className="size-3.5 shrink-0 text-bad" />
                  ) : (
                    <span className="grid size-3.5 shrink-0 place-items-center">
                      <span className="size-1.5 rounded-full bg-fg-3/50" />
                    </span>
                  )}
                  <span className={clsx("num", s.status === "waiting" ? "text-fg-3" : "text-fg-2")}>{fmtRange(s.from, s.to)}</span>
                  <span className="text-fg-3">
                    {s.status === "running" && "· syncing…"}
                    {s.status === "done" && (s.rows ? `· ${formatMetric(s.rows, "number")} rows` : "· no data")}
                  </span>
                  {s.status === "done" && Boolean(s.warnings) && (
                    <span className="text-gold">
                      · {s.warnings} {s.warnings === 1 ? "warning" : "warnings"} (see log)
                    </span>
                  )}
                </div>
                {s.error && <p className="mt-1 ml-5.5 break-words text-bad">{s.error}</p>}
              </li>
            ))}
          </ul>
          {finished && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-good/30 bg-good/10 px-3 py-2.5 text-sm text-fg-2">
              <Check className="mt-0.5 size-4 shrink-0 text-good" />
              Done. Pulled {formatMetric(rows, "number")} rows for {fmtRange(steps.at(-1)!.from, steps[0]!.to)}.
            </p>
          )}
          {done.some((s) => !s.rows) && (
            <p className="mt-2 text-xs text-fg-3">&ldquo;No data&rdquo; means no ads ran then, or it&apos;s further back than your Windsor plan allows.</p>
          )}
        </div>
      )}
    </div>
  );
}
