import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser, homePathFor } from "@/lib/auth/current";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect(await homePathFor(user));
  const { next } = await searchParams;

  return (
    <AuthShell>
      <div className="eyebrow mb-3 text-cyan!">Client dashboard</div>
      <h1 className="font-serif text-[2.4rem] leading-[1.05] text-fg">Welcome back.</h1>
      <p className="mt-3 text-[0.95rem] text-fg-2">Sign in to see how your Facebook &amp; Instagram campaigns are moving today.</p>
      <LoginForm next={typeof next === "string" ? next : undefined} />
      <p className="mt-8 text-xs text-fg-3">
        Need access or forgot your password? Your Thinkswell team can send you a fresh sign-in link.
      </p>
    </AuthShell>
  );
}
