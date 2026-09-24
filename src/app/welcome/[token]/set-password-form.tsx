"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { setPasswordFromToken } from "@/app/actions/auth";
import { Button } from "@/components/ui";

export function SetPasswordForm({ token, cta }: { token: string; cta: string }) {
  const [state, action, pending] = useActionState(setPasswordFromToken, undefined);
  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="password" className="tw-label">
          New password
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="tw-input" />
        <p className="mt-1.5 text-xs text-fg-3">At least 10 characters. A short phrase works great.</p>
        {state?.fieldErrors?.password && <p className="mt-1 text-xs text-bad">{state.fieldErrors.password[0]}</p>}
      </div>
      <div>
        <label htmlFor="confirm" className="tw-label">
          Confirm password
        </label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="tw-input" />
        {state?.fieldErrors?.confirm && <p className="mt-1.5 text-xs text-bad">{state.fieldErrors.confirm[0]}</p>}
      </div>
      {state?.error && (
        <p role="alert" className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2.5 text-sm text-fg-2">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full py-3.5 text-[0.9rem]">
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {cta}
        {!pending && <ArrowRight className="size-4" />}
      </Button>
    </form>
  );
}
