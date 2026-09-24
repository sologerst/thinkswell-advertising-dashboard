import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { findValidToken } from "@/lib/auth/tokens";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Set your password" };

export default async function WelcomePage({ params }: PageProps<"/welcome/[token]">) {
  const { token } = await params;
  const row = await findValidToken(token);
  const db = await getDb();
  const user = row ? (await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, row.userId)))[0] : null;

  if (!row || !user) {
    return (
      <AuthShell>
        <h1 className="font-serif text-[2.2rem] leading-tight text-fg">This link has expired.</h1>
        <p className="mt-3 text-fg-2">
          Sign-in links work once and expire after a few days. Ask your Thinkswell contact to send you a fresh one.
        </p>
        <Link href="/login" className="mt-8 inline-block text-sm font-semibold text-cyan hover:underline">
          Go to sign in →
        </Link>
      </AuthShell>
    );
  }

  const firstName = user.name.split(" ")[0];
  const invite = row.purpose === "invite";
  return (
    <AuthShell>
      <div className="eyebrow mb-3 text-cyan!">{invite ? "You're invited" : "Password reset"}</div>
      <h1 className="font-serif text-[2.4rem] leading-[1.05] text-fg">{invite ? `Hey ${firstName}, welcome in.` : `Let's get you back in, ${firstName}.`}</h1>
      <p className="mt-3 text-[0.95rem] text-fg-2">
        {invite ? "Pick a password to finish setting up your dashboard login" : "Choose a new password for"} <span className="font-semibold text-fg">{user.email}</span>.
      </p>
      <SetPasswordForm token={token} cta={invite ? "Create my login" : "Save new password"} />
    </AuthShell>
  );
}
