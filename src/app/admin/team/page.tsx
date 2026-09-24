import { KeyRound, UserCheck, UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { createAccessLink, inviteAdmin, setUserDisabled } from "@/app/actions/admin";
import { ActionForm, InlineAction } from "@/components/admin/action-form";
import { Avatar, Card, SectionTitle, UserStatus } from "@/components/ui";
import { admins, clientLogins } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth/current";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireAdmin();
  const [team, logins] = await Promise.all([admins(), clientLogins()]);

  return (
    <>
      <div className="mb-8 animate-rise">
        <div className="eyebrow mb-2 text-cyan!">Admin console</div>
        <h1 className="font-serif text-[2.6rem] leading-[1.05] text-fg">People &amp; logins</h1>
        <p className="mt-2 text-sm text-fg-2">Thinkswell admins can see and configure every client. Client logins only see the dashboards they&apos;re added to.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Card className="p-5 sm:p-6">
          <SectionTitle eyebrow="Thinkswell" title="Admins" className="mb-4" />
          <ul className="divide-y divide-line">
            {team.map((u) => (
              <li key={u.id} className="flex flex-wrap items-start gap-3 py-3">
                <Avatar name={u.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-fg">{u.name}</span>
                    {u.id === me.id && <span className="text-xs text-fg-3">(you)</span>}
                    <UserStatus status={u.status} />
                  </div>
                  <div className="truncate text-xs text-fg-3">
                    {u.email} · {u.lastLoginAt ? `last seen ${timeAgo(u.lastLoginAt)}` : "hasn't signed in yet"}
                  </div>
                </div>
                {u.id !== me.id && (
                  <div className="flex flex-wrap items-start gap-2">
                    <InlineAction action={createAccessLink} hidden={{ userId: u.id }} label="Access link" icon={<KeyRound className="size-3.5" />} />
                    <form action={setUserDisabled}>
                      <input type="hidden" name="userId" value={u.id} />
                      <input type="hidden" name="disable" value={u.status === "disabled" ? "0" : "1"} />
                      <button className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-semibold text-fg-2 transition hover:border-gold/50 hover:text-fg">
                        {u.status === "disabled" ? <UserCheck className="size-3.5" /> : <UserX className="size-3.5" />}
                        {u.status === "disabled" ? "Enable" : "Disable"}
                      </button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-2xl border border-line bg-ink-900/40 p-4">
            <div className="mb-3 text-sm font-bold text-fg">Add a Thinkswell admin</div>
            <ActionForm action={inviteAdmin} submitLabel="Create admin login" pendingLabel="Creating…" clearOnSuccess>
              <div className="grid gap-3 md:grid-cols-2">
                <input name="name" placeholder="Full name" required className="tw-input" />
                <input name="email" type="email" placeholder="name@thinkswell.com" required className="tw-input" />
              </div>
            </ActionForm>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <SectionTitle eyebrow="Clients" title="Client logins" className="mb-4" />
          {logins.length === 0 ? (
            <p className="text-sm text-fg-3">No client logins yet. Invite people from a client&apos;s setup page.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-[0.7rem] tracking-wider text-fg-3 uppercase">
                    <th className="pb-3 font-bold">Person</th>
                    <th className="pb-3 font-bold">Dashboards</th>
                    <th className="pb-3 font-bold">Status</th>
                    <th className="pb-3 text-right font-bold">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {logins.map((u) => (
                    <tr key={u.id} className="border-t border-line">
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-fg">{u.name}</div>
                        <div className="text-xs text-fg-3">{u.email}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {u.clients.length === 0 && <span className="text-xs text-fg-3">None</span>}
                          {u.clients.map((c) => (
                            <Link key={c.id} href={`/admin/clients/${c.id}#people`} className="rounded-full border border-line px-2 py-0.5 text-xs text-fg-2 transition hover:border-cyan/50 hover:text-fg">
                              {c.name}
                            </Link>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <UserStatus status={u.status} />
                      </td>
                      <td className="py-3 text-right text-xs text-fg-3">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
