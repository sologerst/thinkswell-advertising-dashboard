"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  // Controlled so a failed attempt doesn't wipe the email (React resets uncontrolled fields).
  const [email, setEmail] = useState("");
  return (
    <form action={action} className="mt-8 space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label htmlFor="email" className="tw-label">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="tw-input" placeholder="you@company.com" />
        {state?.fieldErrors?.email && <p className="mt-1.5 text-xs text-bad">{state.fieldErrors.email[0]}</p>}
      </div>
      <div>
        <label htmlFor="password" className="tw-label">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="tw-input" placeholder="••••••••••" />
        {state?.fieldErrors?.password && <p className="mt-1.5 text-xs text-bad">{state.fieldErrors.password[0]}</p>}
      </div>
      {state?.error && (
        <p role="alert" className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2.5 text-sm text-fg-2">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full py-3.5 text-[0.9rem]">
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {pending ? "Signing in…" : "Sign in"}
        {!pending && <ArrowRight className="size-4" />}
      </Button>
    </form>
  );
}
