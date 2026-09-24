import { ArrowLeft, Eye } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { BrandLockup } from "@/components/brand";
import { ClientSwitcher, NavTabs, UserMenu } from "@/components/shell";
import { listAccessibleClients, requireClientAccess } from "@/lib/auth/current";

const pick = (c: { name: string; slug: string; logoUrl: string | null }) => ({ name: c.name, slug: c.slug, logoUrl: c.logoUrl });

export default async function ClientLayout({ children, params }: LayoutProps<"/c/[slug]">) {
  const { slug } = await params;
  const { user, client, isPreview } = await requireClientAccess(slug);
  const clients = await listAccessibleClients(user);

  return (
    <div className="min-h-dvh">
      {isPreview && (
        <div className="border-b border-gold/25 bg-gold/10 px-4 py-2 text-center text-xs font-semibold text-gold">
          <Eye className="mr-1.5 inline size-3.5 align-[-2px]" />
          Previewing {client.name}&apos;s dashboard exactly as their team sees it.{" "}
          <Link href={`/admin/clients/${client.id}`} className="underline underline-offset-2 hover:text-fg">
            Edit setup
          </Link>
          {" · "}
          <Link href="/admin" className="underline underline-offset-2 hover:text-fg">
            <ArrowLeft className="inline size-3 align-[-1px]" /> Admin
          </Link>
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-line bg-ink-900/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <BrandLockup size={30} className="[&>span]:hidden sm:[&>span]:inline" />
          <span className="h-6 w-px bg-line-strong" />
          <ClientSwitcher current={pick(client)} clients={clients.map(pick)} />
          <div className="ml-4 hidden md:block">
            <Suspense>
              <NavTabs
                tabs={[
                  { href: `/c/${slug}`, label: "Overview", exact: true },
                  { href: `/c/${slug}/campaigns`, label: "Campaigns" },
                ]}
              />
            </Suspense>
          </div>
          <div className="ml-auto">
            <UserMenu name={user.name} email={user.email} isAdmin={user.role === "admin"} />
          </div>
        </div>
        <div className="border-t border-line px-2 py-1.5 md:hidden">
          <Suspense>
            <NavTabs
              tabs={[
                { href: `/c/${slug}`, label: "Overview", exact: true },
                { href: `/c/${slug}/campaigns`, label: "Campaigns" },
              ]}
            />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 pt-8 pb-20 sm:px-6 lg:px-8">{children}</main>
      <footer className="mx-auto max-w-[1400px] px-4 pb-10 text-xs text-fg-3 sm:px-6 lg:px-8">
        Data from Meta Ads (Facebook &amp; Instagram) via Windsor.ai. Results use Meta&apos;s default attribution. Questions? Your Thinkswell team is one message away.
      </footer>
    </div>
  );
}
