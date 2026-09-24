import { logout } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui";
import { requireUser } from "@/lib/auth/current";

export default async function NoAccessPage() {
  const user = await requireUser();
  return (
    <AuthShell>
      <h1 className="font-serif text-[2.2rem] leading-tight text-fg">You&apos;re signed in, {user.name.split(" ")[0]}.</h1>
      <p className="mt-3 text-fg-2">
        There isn&apos;t a dashboard connected to your login yet. Your Thinkswell team will add you as soon as your campaigns are set up.
      </p>
      <form action={logout} className="mt-8">
        <Button variant="secondary">Sign out</Button>
      </form>
    </AuthShell>
  );
}
