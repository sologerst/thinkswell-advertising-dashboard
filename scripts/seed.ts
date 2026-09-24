/**
 * npm run db:seed            -> migrate + ensure the first admin exists
 * npm run db:seed -- --demo  -> also create demo clients, users and 120 days of demo ads data
 *
 * Env: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME (defaults are for local demo only).
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { createDb, runMigrations } from "@/lib/db/connect";
import { and } from "drizzle-orm";
import { campaignGroups, campaignSettings, clientAccounts, clientMembers, clients, memberGroups, users, type FeeType, type GoalType } from "@/lib/db/schema";
import { addDays, todayISO } from "@/lib/dates";
import { GOAL_PRESETS } from "@/lib/metrics/catalog";
import { syncDemo } from "@/lib/sync/demo-sync";

const DEMO_PASSWORD = "thinkswell-demo";

async function main() {
  const demo = process.argv.includes("--demo");
  const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  const db = await createDb();
  await runMigrations(db);
  console.log("✓ migrations applied");

  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@thinkswell.demo").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? (isProd ? undefined : DEMO_PASSWORD);
  if (!adminPassword) throw new Error("Set ADMIN_PASSWORD to create the first admin in production.");

  const [existing] = await db.select().from(users).where(eq(users.email, adminEmail));
  if (!existing) {
    await db.insert(users).values({
      email: adminEmail,
      name: process.env.ADMIN_NAME ?? "Thinkswell Admin",
      role: "admin",
      status: "active",
      passwordHash: await bcrypt.hash(adminPassword, 12),
    });
    console.log(`✓ admin created: ${adminEmail}`);
  } else {
    console.log(`• admin exists: ${adminEmail}`);
  }

  if (!demo) return;

  const today = todayISO();
  const { rows } = await syncDemo(db, { from: addDays(today, -119), to: today, triggeredBy: "seed" });
  console.log(`✓ demo ads data: ${rows.toLocaleString()} rows`);

  const demoClients: {
    name: string;
    slug: string;
    goal: GoalType;
    accounts: string[];
    feeType: FeeType;
    feePercent?: number;
    feeFlatMonthly?: number;
    welcomeNote: string;
  }[] = [
    {
      name: "Neon Mesa Music Hall",
      slug: "neon-mesa",
      goal: "sales",
      accounts: ["100100100"],
      feeType: "percent",
      feePercent: 15,
      welcomeNote: "Halloween presale is pacing ahead of plan — we're shifting more budget into the Crowd Energy Reel, it's our top seller.",
    },
    {
      name: "Cumberland Social House",
      slug: "cumberland-social",
      goal: "leads",
      accounts: ["100100200"],
      feeType: "flat",
      feeFlatMonthly: 2500,
      welcomeNote: "Holiday party inquiries are rolling in. Reply to new leads within the hour — speed wins bookings!",
    },
    {
      name: "The Velvet Ramblers",
      slug: "velvet-ramblers",
      goal: "awareness",
      accounts: ["100100300"],
      feeType: "percent_plus_flat",
      feePercent: 10,
      feeFlatMonthly: 1000,
      welcomeNote: "“Gravel Road” is out! Video completion rates are well above benchmark — fans are watching all the way through.",
    },
    {
      name: "Magnolia & Main Hotel",
      slug: "magnolia-main",
      goal: "traffic",
      accounts: ["100100400"],
      feeType: "percent",
      feePercent: 12,
      welcomeNote: "Fall getaway campaign is live. We're testing new suite photography this week.",
    },
  ];

  const ids: Record<string, string> = {};
  for (const c of demoClients) {
    const [row] = await db
      .insert(clients)
      .values({
        name: c.name,
        slug: c.slug,
        goal: c.goal,
        kpis: GOAL_PRESETS[c.goal].kpis,
        feeType: c.feeType,
        feePercent: c.feePercent ?? 0,
        feeFlatMonthly: c.feeFlatMonthly ?? 0,
        welcomeNote: c.welcomeNote,
      })
      .onConflictDoNothing({ target: clients.slug })
      .returning({ id: clients.id });
    const id = row?.id ?? (await db.select({ id: clients.id }).from(clients).where(eq(clients.slug, c.slug)))[0]!.id;
    ids[c.slug] = id;
    await db
      .insert(clientAccounts)
      .values(c.accounts.map((accountId) => ({ clientId: id, accountId })))
      .onConflictDoNothing();
  }
  console.log(`✓ demo clients: ${demoClients.length}`);

  const demoUsers = [
    { name: "Jordan Reyes", email: "jordan@neonmesa.demo", clients: ["neon-mesa"] },
    { name: "Priya Shah", email: "priya@cumberlandsocial.demo", clients: ["cumberland-social"] },
    { name: "Casey Moore", email: "casey@velvetramblers.demo", clients: ["velvet-ramblers"] },
    { name: "Avery Brooks", email: "avery@magnoliamain.demo", clients: ["magnolia-main"] },
    // A hospitality-group owner who sees two venues and gets a client switcher.
    { name: "Sam Carter", email: "sam@southbound-group.demo", clients: ["neon-mesa", "cumberland-social"] },
  ];
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  for (const u of demoUsers) {
    const [row] = await db
      .insert(users)
      .values({ name: u.name, email: u.email, role: "client", status: "active", passwordHash: hash })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    const id = row?.id ?? (await db.select({ id: users.id }).from(users).where(eq(users.email, u.email)))[0]!.id;
    await db
      .insert(clientMembers)
      .values(u.clients.map((slug) => ({ clientId: ids[slug]!, userId: id })))
      .onConflictDoNothing();
  }
  console.log(`✓ demo client logins: ${demoUsers.length} (password: ${DEMO_PASSWORD})`);

  // Campaign groups, client-friendly names and per-group/campaign goals.
  const demoGroups: Record<string, { name: string; goal?: GoalType; campaigns: [string, string | null, GoalType?][] }[]> = {
    "neon-mesa": [
      { name: "Halloween Bash 2026", campaigns: [["2002", "Halloween Bash: Presale"]] },
      { name: "Fall Concert Series", campaigns: [["2001", "Fall Concert Series: Tickets"], ["2003", "Retargeting: Cart Abandoners"]] },
    ],
    "cumberland-social": [
      { name: "Holiday Parties", campaigns: [["3002", "Holiday Party Bookings"]] },
      { name: "Private Events", campaigns: [["3001", "Private Events: Lead Form"], ["3003", "Rehearsal Dinners"]] },
      { name: "Brand Awareness", goal: "awareness", campaigns: [["3004", "Rooftop Brunch Video"]] },
    ],
    "velvet-ramblers": [
      { name: "New Single: Gravel Road", campaigns: [["4001", "“Gravel Road” Video"]] },
      { name: "Fall Tour", campaigns: [["4002", "Tour Announcement"], ["4003", "Tour Tickets", "sales"]] },
      { name: "Fan Club", goal: "leads", campaigns: [["4004", "Fan Club Sign-ups"]] },
    ],
  };
  const groupIds: Record<string, string> = {};
  for (const [slug, groups] of Object.entries(demoGroups)) {
    const clientId = ids[slug]!;
    for (const [i, g] of groups.entries()) {
      let [row] = await db
        .select({ id: campaignGroups.id })
        .from(campaignGroups)
        .where(and(eq(campaignGroups.clientId, clientId), eq(campaignGroups.name, g.name)));
      if (!row) [row] = await db.insert(campaignGroups).values({ clientId, name: g.name, goal: g.goal ?? null, sortOrder: i }).returning({ id: campaignGroups.id });
      groupIds[`${slug}:${g.name}`] = row!.id;
      for (const [campaignId, displayName, goal] of g.campaigns) {
        await db
          .insert(campaignSettings)
          .values({ clientId, campaignId, displayName, groupId: row!.id, goal: goal ?? null })
          .onConflictDoNothing();
      }
    }
  }

  // An event promoter who only sees the Halloween Bash group.
  const [promoter] = await db
    .insert(users)
    .values({ name: "Morgan Lee", email: "morgan@halloweenbash.demo", role: "client", status: "active", passwordHash: hash })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  const promoterId = promoter?.id ?? (await db.select({ id: users.id }).from(users).where(eq(users.email, "morgan@halloweenbash.demo")))[0]!.id;
  await db.insert(clientMembers).values({ clientId: ids["neon-mesa"]!, userId: promoterId, restricted: true }).onConflictDoNothing();
  await db
    .insert(memberGroups)
    .values({ clientId: ids["neon-mesa"]!, userId: promoterId, groupId: groupIds["neon-mesa:Halloween Bash 2026"]! })
    .onConflictDoNothing();
  console.log("✓ demo campaign groups + a group-limited login (morgan@halloweenbash.demo)");
  console.log("\nSign in at http://localhost:3000 as", adminEmail, "or", demoUsers[0]!.email);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
