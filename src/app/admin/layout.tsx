import { Suspense } from "react";
import { BrandLockup } from "@/components/brand";
import { NavTabs, UserMenu } from "@/components/shell";
import { requireAdmin } from "@/lib/auth/current";
import { isLiveMode } from "@/lib/windsor/client";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  const live = isLiveMode();
  const tabs = [
    { href: "/admin", label: "Clients", exact: true },
    { href: "/admin/team", label: "Team" },
    { href: "/admin/data", label: "Data" },
  ];
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-ink-900/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <BrandLockup href="/admin" size={30} className="[&>span]:hidden sm:[&>span]:inline" />
          <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[0.65rem] font-bold tracking-[0.14em] text-gold uppercase">Admin</span>
          <div className="ml-2 hidden md:block">
            <Suspense>
              <NavTabs tabs={tabs} />
            </Suspense>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span
              className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold sm:inline-flex ${live ? "border-good/30 text-good" : "border-gold/30 text-gold"}`}
            >
              <span className={`size-1.5 rounded-full ${live ? "bg-good" : "bg-gold"}`} />
              {live ? "Windsor live" : "Demo data"}
            </span>
            <UserMenu name={user.name} email={user.email} isAdmin={false} />
          </div>
        </div>
        <div className="border-t border-line px-2 py-1.5 md:hidden">
          <Suspense>
            <NavTabs tabs={tabs} />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 pt-8 pb-20 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
