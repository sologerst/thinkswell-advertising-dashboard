# Thinkswell Ads Dashboard: Product Spec

A branded client portal where each Thinkswell client logs in and sees how their Meta
(Facebook + Instagram) campaigns are doing. It shows numbers by day at a glance, then
lets them click into any campaign for detail. Thinkswell admins decide what each client
sees and how their dashboard is set up.

---

## 1. Goals

| Goal | How it's met |
|---|---|
| Matches thinkswell.com branding | Navy `#111522` base with the site's cyan / gold / purple / coral accents. DM Serif Display headlines, DM Sans UI. The bulb mark + lowercase `thinkswell` lockup. Uppercase tracked eyebrows. |
| Quick numbers by day | KPI cards with sparklines and "vs previous period" deltas; a strip of **day cards** (spend, results, cost per result, best-day badge); a daily trend chart. |
| Drill into campaigns | A Campaigns list (search, live-only filter, sortable) → a campaign page with KPIs, trend, a day-by-day table, FB vs IG split, ad sets and ad creative cards. |
| Per-client logins and setups | Clients have their own goal preset, KPI cards, agency fee, ad accounts and campaign visibility rules. Users are invited per client. |
| Actual spend + agency fee | **Ad spend** card (exactly what Meta billed) followed by a separate **Agency fee** card showing the fee and total investment. |
| Modern and fun | Glow-on-hover cards, count-up numbers, auto-generated highlights ("Best day", "Top campaign", "Instagram is winning"), live-sync pulse, "Top performer" creative badge, a note from the Thinkswell team. |

## 2. Roles & access

| Role | Can do |
|---|---|
| **Admin** (Thinkswell staff) | Everything: create and configure clients, invite people, link ad accounts, run syncs, and preview any client dashboard exactly as the client sees it. |
| **Client user** | Sign in and view only the dashboards they're a member of. Read-only. A user can belong to several clients (e.g. a hospitality group owner) and gets a dashboard switcher. |

Rules:

- Every page and server action re-checks the session, role and client membership on the server. `proxy.ts` only does an optimistic redirect for signed-out visitors.
- All data queries go through one `scopeWhere()` built from the client's ad accounts plus campaign rules, so a client can never see another client's rows. Campaign URLs outside the scope return 404.
- Row-level security is enabled on every table (with no policies) so Supabase's auto-generated Data API can't read them with the anon key. The app connects as the table owner, which bypasses RLS.
- A client user hitting `/admin` is redirected home. Another client's slug returns 404, which also doesn't reveal that the client exists.

## 3. Logins

- **No self sign-up.** An admin adds a person (name + email) on a client's People tab. The app creates the login and returns a **single-use invite link** (7-day expiry) to copy. If `RESEND_API_KEY` is set, the link is also emailed.
- The invite link opens a branded "welcome" page where the person sets a password (10+ characters) and lands on their dashboard.
- **Forgot password:** an admin clicks "Reset link" on that person (24-hour, single-use).
- **Disable / enable** instantly revokes all sessions (`users.session_version` bump). **Remove** takes someone off one client.
- Passwords are hashed with bcrypt (cost 12). The session is an HS256 JWT in an httpOnly, SameSite=Lax, Secure cookie, valid for 30 days.
- After 5 failed logins an account locks for 15 minutes. Errors are generic, and timing is equalised with a dummy hash, so the login form doesn't reveal which emails exist.

## 4. Client "setups"

Each client has:

| Setting | Options |
|---|---|
| **Goal preset** | 🎟️ Ticket sales / E-com · 📬 Lead gen · 📣 Awareness / Video · ⚡ Traffic / Engagement |
| **KPI cards** | Ordered list (up to 10) from the metric catalog; defaults to the goal's preset. |
| **Agency fee** | None · % of ad spend · Monthly retainer · Retainer + %. Custom card title. |
| **Ad accounts** | One or more Meta ad accounts (several clients can share one). |
| **Campaign visibility** | All campaigns · Only selected · All except selected · plus optional "name contains" filter (e.g. `[NEON MESA]`). |
| **Profile** | Name, URL slug (`/c/<slug>`), logo URL, "note from your Thinkswell team". |
| **Campaign groups** | Named bundles of campaigns (e.g. "Halloween Bash 2026") shown as tabs on the Overview and as sections on the Campaigns page. Each group can have its own goal. |
| **Campaign settings** | Per campaign: a client-friendly name, a group, and an optional goal override. |
| **Per-person access** | Each login sees either all campaigns, or only chosen groups. |

### Campaign groups, names and goals

- **Groups** are ordered, renamable and deletable (deleting one ungroups its campaigns). The dashboard shows "All campaigns" plus one tab per group; `?group=<id>` filters every card, chart, day card, table and the platform split to that group.
- **Goal resolution:** campaign override → its group's goal → the client's goal. A group or campaign measured on a different goal gets that goal's preset KPI cards; one on the client's own goal keeps the client's custom cards.
- **Mixed goals:** when a view contains campaigns with different goals, tables switch to a **Results** column with a unit on each row ("1,242 leads", "25,160 ThruPlays") and cost per result ("$5.11 / lead").
- **Friendly names** replace Ads Manager names everywhere clients see them. Admins previewing a campaign also see the Ads Manager name.
- **Agency fee on a group tab** shows only the %-of-spend part for that group's spend. A monthly retainer only shows on the All campaigns view.

### Per-person access

- `client_members.restricted = false` → the person sees everything the client can see.
- `restricted = true` → only campaigns in their `member_groups`. With none, they see a "nothing shared yet" message. Deleting a group removes it from people's access and never widens it.
- Enforced in `lib/client-context.ts` by narrowing the same `scopeWhere()` scope, so the Overview, Campaigns, campaign pages and hand-edited URLs all respect it (other campaigns return 404).
- Limited people don't see the agency fee card. If all their groups share one goal, their overview uses it.

### Goal presets

| Goal | Result | Cost per result | Default KPI cards |
|---|---|---|---|
| Sales | Purchases | Cost / purchase | Revenue, ROAS, Purchases, Cost/purchase, CTR, Adds to cart |
| Leads | Leads | CPL | Leads, CPL, Lead rate, Link clicks, CTR, CPM |
| Awareness | ThruPlays | Cost / ThruPlay | Reach, Impressions, ThruPlays, Video views, CPM, Frequency |
| Traffic | Link clicks | CPC | Link clicks, CTR, CPC, Landing page views, Engagements, Cost/LPV |

The goal's "result" drives day cards, campaign tables, ad cards and highlights.

### Agency fee math

- `%` → `spend × pct` for each day.
- Retainer → `monthly ÷ days in that month` for each day, so any date range (7 days, MTD, custom) gets its fair share.
- The card shows the fee for the period, its delta, the rule ("15% of ad spend") and **total investment** (spend + fee).

## 5. Client dashboard

**Overview** (`/c/<slug>`):
1. Greeting ("Good morning, Jordan."), range, comparison period, platform toggle (All / Facebook / Instagram) and date picker (Today, Yesterday, 7/14/30/90 days, This month, Last month, Custom).
2. Note from the Thinkswell team (optional).
3. **Ad spend** card → **Agency fee** card → goal KPI cards. Each card has a count-up value, a delta vs the previous equal-length period (green or red depending on whether up is good for that metric), a sparkline and a help tooltip.
4. Highlights: best day, top campaign, Facebook vs Instagram winner (or "neck and neck").
5. Daily performance chart: metric tabs, this period vs previous period, crosshair tooltip.
6. **Day by day** cards (newest first, up to 31): spend, results, cost each, relative bars, "Best" and "Live" badges. Tap a day to zoom the whole dashboard to that day.
7. "What's running": top campaigns with status, results, cost/result (with a BEST tag), CTR and a trend sparkline.
8. Facebook vs Instagram: share of spend, results and impressions, plus per-platform cost/result, CTR and CPM.

**Campaigns** (`/c/<slug>/campaigns`): summary stats, then the full sortable/searchable table with a goal-specific extra column (ROAS, lead rate, CPM or LPVs).

**Campaign detail** (`/c/<slug>/campaigns/<id>`): status, objective, flight dates, KPI cards (spend card shows share of total spend), trend chart, day-by-day table with bars, FB vs IG split, ad sets table and ad creative cards (the real image, a playable video or a swipeable carousel, plus a link to Meta's ad preview; copy, spend, results, cost, CTR, "Top performer"). Live ads come first; paused and ended ads sit in a collapsible "Paused & ended" section (open when nothing is running).

## 6. Admin console

- **Clients** (`/admin`): a card per client with 7-day spend, result, cost, fee and sparkline, plus "Open dashboard" and "Setup" buttons. Notices for demo mode and for unassigned ad accounts.
- **Client setup** (`/admin/clients/<id>`): Profile · Dashboard setup · Agency fee · Data access · **Campaigns & groups** (groups editor + per-campaign name/group/goal) · People (invite, per-person access) · Archive.
- **Team** (`/admin/team`): Thinkswell admins (invite, access link, disable) and every client login with the dashboards it can see.
- **Data** (`/admin/data`): Windsor status, sync buttons (7d / 30d / 90d backfill), "Test connection", ad accounts with owner client and 30-day spend, and the sync log.

## 7. Data pipeline (Windsor.ai → Postgres)

```
Vercel Cron (daily) ─┐
Admin "Sync" button ─┼─► syncWindsor(from, to)
CLI `npm run sync` ──┘      │
                            ├─ GET onboard.windsor.ai/api/common/ds-accounts?datasource=facebook
                            └─ per ad account:
                                 1. GET connectors.windsor.ai/facebook  (daily × ad × publisher_platform metrics)
                                 2. GET connectors.windsor.ai/facebook  (statuses, objectives, thumbnails; no breakdown)
                                 3. GET connectors.windsor.ai/facebook  (creative: image / video URLs, preview links)
                                 4. upsert campaigns / ad_sets / ads
                                 5. delete + insert `insights` for the window (in one transaction)
```

- Dashboards read only from Postgres, so they're fast, never hit Windsor rate limits, and keep working if Windsor has an outage.
- Each run re-pulls a rolling window (`SYNC_LOOKBACK_DAYS`, default 7) because Meta keeps attributing conversions for up to ~28 days. The Data page has 30 and 90-day buttons for backfills.
- Meta won't combine the `publisher_platform` breakdown with `omni_*` fields, so metrics use the non-omni action types, and metadata comes from a second breakdown-free call.
- Field mapping lives in `src/lib/sync/windsor-sync.ts` (`METRIC_FIELDS`). To count e.g. pixel-only purchases, change `actions_purchase` to `actions_offsite_conversion_fb_pixel_purchase` there.
- Steps 2 and 3 cover at least the last 120 days, so ads that stopped delivering still get current statuses and fresh creative links (Meta CDN links expire after a few days). Creative fields are stored raw in `ads.creative` and interpreted in `src/lib/creative.ts`; if Windsor rejects the combined request, each field group is retried on its own.
- Every run is logged in `sync_runs`. Per-account failures become warnings and don't abort the rest of the run.

| Our column | Windsor field |
|---|---|
| spend, impressions, reach, clicks | `spend`, `impressions`, `reach`, `clicks` |
| link_clicks | `link_clicks` |
| landing_page_views | `actions_landing_page_view` |
| purchases / purchase_value | `actions_purchase` / `action_values_purchase` |
| add_to_cart / initiate_checkout | `actions_add_to_cart` / `actions_initiate_checkout` |
| leads | `actions_lead` |
| video_views / thruplays | `actions_video_view` / `video_thruplay_watched_actions_video_view` |
| post_engagement | `actions_post_engagement` |

**Demo mode:** with no `WINDSOR_API_KEY`, the same pipeline writes deterministic demo data (4 fictional Nashville clients + a sandbox account). The whole product can be reviewed before Windsor is connected.

## 8. Data model

```
users(id, email, name, password_hash, role, status, session_version, failed_logins, locked_until, last_login_at)
auth_tokens(id, user_id, token_hash, purpose[invite|reset], expires_at, used_at)
clients(id, name, slug, logo_url, welcome_note, goal, kpis[], fee_type, fee_percent, fee_flat_monthly,
        fee_label, campaign_mode, campaign_name_filter, archived_at)
client_members(client_id, user_id, restricted) -- who can see which dashboard
campaign_groups(id, client_id, name, goal, sort_order)
campaign_settings(client_id, campaign_id, display_name, group_id, goal)
member_groups(client_id, user_id, group_id)   -- groups a restricted member may see
client_accounts(client_id, account_id)        -- which ad accounts feed it
client_campaigns(client_id, campaign_id)      -- include/exclude list
ad_accounts(id, name, currency, source, last_synced_at)
campaigns(id, account_id, name, status, objective, …)
ad_sets(id, campaign_id, account_id, name, status)
ads(id, ad_set_id, campaign_id, account_id, name, status, thumbnail_url, title, body, creative jsonb)
insights(date, account_id, campaign_id, ad_set_id, ad_id, platform, spend, impressions, reach, clicks,
         link_clicks, landing_page_views, purchases, purchase_value, add_to_cart, initiate_checkout,
         leads, video_views, thruplays, post_engagement)   UNIQUE(date, ad_id, platform)
sync_runs(id, source, status, date_from, date_to, rows, error, triggered_by, started_at, finished_at)
```

Ratios (CTR, CPC, CPM, ROAS, CPL…) are always computed **after** summing, never averaged.
Reach is summed across days, which over-counts people reached on several days; the help
tooltip says so.

## 9. Stack & hosting

- **Next.js 16** (App Router, server components, server actions, `proxy.ts`), React 19, TypeScript, Tailwind CSS 4.
- **Drizzle ORM** on **Supabase Postgres** (transaction pooler) in production. Embedded **PGlite** locally, so `npm run setup && npm run dev` needs no database install.
- Recharts for the trend chart. Hand-rolled SVG sparklines and share bars.
- **Vercel** hosting + **Vercel Cron** for scheduled syncs. Optional **Resend** for invite emails.
- Chart colors are the brand hues stepped for the navy surface and validated for color-blind separation. Platform identity is also shown with icons and labels, never color alone.

## 10. Roadmap (not built yet)

1. **Google Ads, TikTok** via the same Windsor pipeline (`insights.source` column + connector map).
2. **Self-serve password reset** by email (needs Resend configured).
3. **Scheduled email reports**: weekly PDF/HTML summary per client.
4. **Pacing & budgets**: monthly budget per client with a pace-to-date meter.
5. **Annotations**: admins pin notes to dates ("Presale launched") that show on charts.
6. **Client branding**: per-client accent color on top of the Thinkswell theme.
7. **Unique reach** for date ranges via a separate range-level Windsor pull.
8. **Audit log** of admin changes.
