import { eq } from "drizzle-orm";
import { ArrowLeft, ArrowUpRight, KeyRound, Layers, UserCheck, UserMinus, UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  createAccessLink,
  inviteClientUser,
  removeMember,
  saveCampaignSettings,
  saveGroups,
  setClientArchived,
  setMemberAccess,
  setUserDisabled,
  updateClientAccess,
  updateClientFee,
  updateClientProfile,
  updateClientSetup,
} from "@/app/actions/admin";
import { ActionForm, InlineAction } from "@/components/admin/action-form";
import { CampaignSettingsEditor, GroupsEditor, MemberAccessFields } from "@/components/admin/campaign-fields";
import { AccessFields, FeeFields, SetupFields } from "@/components/admin/setup-fields";
import { Avatar, ButtonLink, Card, ClientBadge, Notice, UserStatus } from "@/components/ui";
import { accountsWithUsage, groupSetup, membersOf } from "@/lib/admin-data";
import { getDb } from "@/lib/db";
import { clientAccounts, clientCampaigns, clients } from "@/lib/db/schema";
import { timeAgo } from "@/lib/format";
import { listCampaignsForAccounts } from "@/lib/metrics/query";

type Props = PageProps<"/admin/clients/[id]">;

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getDb();
  const [client] = await db.select().from(clients).where(eq(clients.id, id));
  return client ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await load((await params).id);
  return { title: c ? `${c.name} setup` : "Client" };
}

export default async function ClientSetupPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { created } = await searchParams;
  const client = await load(id);
  if (!client) notFound();

  const db = await getDb();
  const [accounts, linked, picked, members, gs] = await Promise.all([
    accountsWithUsage(),
    db.select({ id: clientAccounts.accountId }).from(clientAccounts).where(eq(clientAccounts.clientId, id)),
    db.select({ id: clientCampaigns.campaignId }).from(clientCampaigns).where(eq(clientCampaigns.clientId, id)),
    membersOf(id),
    groupSetup(id),
  ]);
  const campaignOptions = await listCampaignsForAccounts(accounts.map((a) => a.id));

  // Campaigns this client can actually see, for naming/grouping (mirrors scopeWhere's rules).
  const linkedIds = new Set(linked.map((l) => l.id));
  const pickedIds = new Set(picked.map((p) => p.id));
  const nameFilter = client.campaignNameFilter?.trim().toLowerCase();
  const visibleCampaigns = campaignOptions
    .filter((c) => linkedIds.has(c.accountId))
    .filter((c) => (client.campaignMode === "include" ? pickedIds.has(c.id) : client.campaignMode === "exclude" ? !pickedIds.has(c.id) : true))
    .filter((c) => !nameFilter || c.name.toLowerCase().includes(nameFilter))
    .sort((a, b) => Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE") || a.name.localeCompare(b.name));
  const groupOpts = gs.groups.map((g) => ({ id: g.id, name: g.name, goal: g.goal }));

  return (
    <>
      <Link href="/admin" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-3 transition hover:text-cyan">
        <ArrowLeft className="size-4" /> Clients
      </Link>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <ClientBadge name={client.name} logoUrl={client.logoUrl} className="size-14! rounded-2xl! text-base!" />
          <div>
            <div className="eyebrow mb-1 text-cyan!">Client setup{client.archivedAt ? " · archived" : ""}</div>
            <h1 className="font-serif text-[2.3rem] leading-[1.05] text-fg">{client.name}</h1>
          </div>
        </div>
        <ButtonLink href={`/c/${client.slug}`} variant="secondary">
          Preview dashboard <ArrowUpRight className="size-4" />
        </ButtonLink>
      </div>

      {created && (
        <Notice tone="good" className="mb-6">
          <strong className="text-good">Client created.</strong> Next: link their ad account under <a href="#access" className="underline">Data access</a>, then invite
          their team under <a href="#people" className="underline">People</a>.
        </Notice>
      )}

      <div className="grid gap-8 xl:grid-cols-[200px_1fr]">
        <nav className="hidden xl:block">
          <div className="sticky top-24 space-y-1 text-sm">
            {[
              ["#profile", "Profile"],
              ["#dashboard", "Dashboard setup"],
              ["#fee", "Agency fee"],
              ["#access", "Data access"],
              ["#campaigns", "Campaigns & groups"],
              ["#people", "People"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="block rounded-lg px-3 py-1.5 font-semibold text-fg-3 transition hover:bg-white/5 hover:text-fg">
                {label}
              </a>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-6">
          <Section id="profile" title="Profile" sub="Name, dashboard URL, logo and a note that sits at the top of their dashboard.">
            <ActionForm action={updateClientProfile}>
              <input type="hidden" name="id" value={client.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Client name">
                  <input name="name" defaultValue={client.name} required className="tw-input" />
                </Field>
                <Field label="Dashboard URL slug" hint={`/c/${client.slug}`}>
                  <input name="slug" defaultValue={client.slug} required className="tw-input" />
                </Field>
                <Field label="Logo URL" hint="Optional. A square https:// image; we fall back to initials.">
                  <input name="logoUrl" defaultValue={client.logoUrl ?? ""} placeholder="https://…" className="tw-input" />
                </Field>
                <Field label="Note from Thinkswell" hint="Optional. Shows as a highlighted note on their overview.">
                  <textarea name="welcomeNote" defaultValue={client.welcomeNote ?? ""} rows={3} maxLength={400} className="tw-input resize-y" />
                </Field>
              </div>
            </ActionForm>
          </Section>

          <Section id="dashboard" title="Dashboard setup" sub="Pick the goal and the KPI cards this client sees. Ad spend always comes first.">
            <ActionForm action={updateClientSetup}>
              <input type="hidden" name="id" value={client.id} />
              <SetupFields initialGoal={client.goal} initialKpis={client.kpis} />
            </ActionForm>
          </Section>

          <Section id="fee" title="Agency fee" sub="Shown as its own card next to Ad spend, with a running total investment.">
            <ActionForm action={updateClientFee}>
              <input type="hidden" name="id" value={client.id} />
              <FeeFields initial={{ feeType: client.feeType, feePercent: client.feePercent, feeFlatMonthly: client.feeFlatMonthly, feeLabel: client.feeLabel }} />
            </ActionForm>
          </Section>

          <Section id="access" title="Data access" sub="Which Meta ad accounts and campaigns feed this dashboard.">
            <ActionForm action={updateClientAccess}>
              <input type="hidden" name="id" value={client.id} />
              <AccessFields
                accounts={accounts.map((a) => ({ id: a.id, name: a.name, source: a.source, usedBy: a.usedBy.filter((n) => n !== client.name) }))}
                campaigns={campaignOptions}
                initial={{
                  accounts: linked.map((l) => l.id),
                  campaignMode: client.campaignMode,
                  campaigns: picked.map((p) => p.id),
                  campaignNameFilter: client.campaignNameFilter ?? "",
                }}
              />
            </ActionForm>
          </Section>

          <Section
            id="campaigns"
            title="Campaigns & groups"
            sub="Bundle campaigns into groups that show as tabs on the dashboard, rename campaigns for the client, and set what each one is measured on."
          >
            <div className="mb-2 text-sm font-bold text-fg">Groups</div>
            <ActionForm action={saveGroups} submitLabel="Save groups">
              <input type="hidden" name="clientId" value={client.id} />
              <GroupsEditor key={gs.groups.map((g) => g.id).join()} initial={groupOpts} clientGoal={client.goal} />
            </ActionForm>
            <div className="mt-8 mb-2 text-sm font-bold text-fg">Campaigns</div>
            <ActionForm action={saveCampaignSettings} submitLabel="Save campaigns">
              <input type="hidden" name="clientId" value={client.id} />
              <CampaignSettingsEditor
                key={gs.groups.map((g) => g.id).join()}
                groups={groupOpts}
                clientGoal={client.goal}
                campaigns={visibleCampaigns.map((c) => {
                  const st = gs.settings.get(c.id);
                  return { id: c.id, name: c.name, status: c.status, displayName: st?.displayName ?? "", groupId: st?.groupId ?? "", goal: st?.goal ?? "" };
                })}
              />
            </ActionForm>
          </Section>

          <Section id="people" title="People" sub="Everyone here can sign in and see this dashboard, and nothing else. Limit someone to certain groups to share just one event or promo.">
            {members.length === 0 ? (
              <p className="mb-5 rounded-xl border border-dashed border-line p-4 text-sm text-fg-3">No one has access yet. Invite the client&apos;s team below.</p>
            ) : (
              <ul className="mb-6 divide-y divide-line rounded-2xl border border-line">
                {members.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-start gap-3 p-3.5">
                    <Avatar name={m.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-fg">{m.name}</span>
                        <UserStatus status={m.status} />
                      </div>
                      <div className="truncate text-xs text-fg-3">
                        {m.email} · {m.lastLoginAt ? `last seen ${timeAgo(m.lastLoginAt)}` : "hasn't signed in yet"}
                      </div>
                      {groupOpts.length > 0 && (
                        <details className="group/acc mt-2">
                          <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-fg-2 hover:text-cyan">
                            <Layers className="size-3.5 text-gold" />
                            {m.restricted
                              ? `Sees only: ${(gs.accessByUser.get(m.id) ?? []).map((gid) => groupOpts.find((g) => g.id === gid)?.name).filter(Boolean).join(", ") || "nothing yet"}`
                              : "Sees all campaigns"}
                            <span className="text-fg-3 group-open/acc:hidden">· change</span>
                          </summary>
                          <div className="mt-2 max-w-lg rounded-xl border border-line bg-ink-900/60 p-3">
                            <ActionForm action={setMemberAccess} submitLabel="Save access" variant="secondary">
                              <input type="hidden" name="clientId" value={client.id} />
                              <input type="hidden" name="userId" value={m.id} />
                              <MemberAccessFields groups={groupOpts} restricted={m.restricted} selected={gs.accessByUser.get(m.id) ?? []} />
                            </ActionForm>
                          </div>
                        </details>
                      )}
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      <InlineAction action={createAccessLink} hidden={{ userId: m.id }} label={m.hasPassword ? "Reset link" : "Invite link"} icon={<KeyRound className="size-3.5" />} />
                      <form action={setUserDisabled}>
                        <input type="hidden" name="userId" value={m.id} />
                        <input type="hidden" name="disable" value={m.status === "disabled" ? "0" : "1"} />
                        <button className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-semibold text-fg-2 transition hover:border-gold/50 hover:text-fg">
                          {m.status === "disabled" ? <UserCheck className="size-3.5" /> : <UserX className="size-3.5" />}
                          {m.status === "disabled" ? "Enable" : "Disable"}
                        </button>
                      </form>
                      <form action={removeMember}>
                        <input type="hidden" name="userId" value={m.id} />
                        <input type="hidden" name="clientId" value={client.id} />
                        <button className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1.5 text-xs font-semibold text-fg-2 transition hover:border-bad/50 hover:text-bad">
                          <UserMinus className="size-3.5" /> Remove
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-2xl border border-line bg-ink-900/40 p-4">
              <div className="mb-3 text-sm font-bold text-fg">Invite someone</div>
              <ActionForm action={inviteClientUser} submitLabel="Create login" pendingLabel="Creating…" clearOnSuccess>
                <input type="hidden" name="clientId" value={client.id} />
                <div className="grid gap-3 md:grid-cols-2">
                  <input name="name" placeholder="Full name" required className="tw-input" />
                  <input name="email" type="email" placeholder="name@company.com" required className="tw-input" />
                </div>
                {groupOpts.length > 0 && (
                  <div className="mt-3">
                    <div className="tw-label">What can they see?</div>
                    <MemberAccessFields groups={groupOpts} restricted={false} selected={[]} />
                  </div>
                )}
                <p className="mt-2 text-xs text-fg-3">
                  You&apos;ll get a one-time link to send them (it&apos;s emailed automatically if email is configured). Adding someone who already has a login just gives them access to
                  this dashboard too.
                </p>
              </ActionForm>
            </div>
          </Section>

          <Section id="danger" title="Archive" sub="Hides the dashboard from everyone. Data and settings are kept, and you can restore it anytime.">
            <form action={setClientArchived}>
              <input type="hidden" name="id" value={client.id} />
              <input type="hidden" name="archive" value={client.archivedAt ? "0" : "1"} />
              <button className="rounded-xl border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm font-bold text-bad transition hover:bg-bad/20">
                {client.archivedAt ? "Restore client" : "Archive client"}
              </button>
            </form>
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ id, title, sub, children }: { id: string; title: string; sub: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24 p-5 sm:p-6">
      <h2 className="font-serif text-[1.45rem] leading-tight text-fg">{title}</h2>
      <p className="mt-1 mb-5 text-sm text-fg-3">{sub}</p>
      {children}
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="tw-label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-fg-3">{hint}</span>}
    </label>
  );
}
