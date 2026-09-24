import { relations, sql } from "drizzle-orm";
import {
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* People & access                                                     */
/* ------------------------------------------------------------------ */

export type UserRole = "admin" | "client";
export type UserStatus = "invited" | "active" | "disabled";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  role: text("role").$type<UserRole>().notNull().default("client"),
  status: text("status").$type<UserStatus>().notNull().default("invited"),
  // Bumped on password change / disable so existing sessions stop working.
  sessionVersion: integer("session_version").notNull().default(1),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TokenPurpose = "invite" | "reset";

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    purpose: text("purpose").$type<TokenPurpose>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_tokens_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------------ */
/* Clients & their dashboard setups                                    */
/* ------------------------------------------------------------------ */

export type GoalType = "sales" | "leads" | "awareness" | "traffic";
export type FeeType = "none" | "percent" | "flat" | "percent_plus_flat";
export type CampaignMode = "all" | "include" | "exclude";

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  welcomeNote: text("welcome_note"),
  goal: text("goal").$type<GoalType>().notNull().default("sales"),
  // Ordered metric keys shown as KPI cards (see lib/metrics/catalog.ts).
  kpis: jsonb("kpis").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  feeType: text("fee_type").$type<FeeType>().notNull().default("none"),
  feePercent: doublePrecision("fee_percent").notNull().default(0),
  feeFlatMonthly: doublePrecision("fee_flat_monthly").notNull().default(0),
  feeLabel: text("fee_label").notNull().default("Agency fee"),
  campaignMode: text("campaign_mode").$type<CampaignMode>().notNull().default("all"),
  // Optional case-insensitive "campaign name contains" filter, e.g. "[NEON MESA]".
  campaignNameFilter: text("campaign_name_filter"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientMembers = pgTable(
  "client_members",
  {
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.userId] }), index("client_members_user_idx").on(t.userId)],
);

export const clientAccounts = pgTable(
  "client_accounts",
  {
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.accountId] })],
);

// Campaign allow/deny list, interpreted by clients.campaignMode.
export const clientCampaigns = pgTable(
  "client_campaigns",
  {
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    campaignId: text("campaign_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.campaignId] })],
);

/* ------------------------------------------------------------------ */
/* Meta ads data (synced from Windsor.ai, or generated in demo mode)   */
/* ------------------------------------------------------------------ */

export const adAccounts = pgTable("ad_accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("USD"),
  source: text("source").$type<"windsor" | "demo">().notNull().default("windsor"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
});

export const campaigns = pgTable(
  "campaigns",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    name: text("name").notNull(),
    status: text("status"),
    objective: text("objective"),
    dailyBudget: doublePrecision("daily_budget"),
    lifetimeBudget: doublePrecision("lifetime_budget"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("campaigns_account_idx").on(t.accountId)],
);

export const adSets = pgTable(
  "ad_sets",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id").notNull(),
    accountId: text("account_id").notNull(),
    name: text("name").notNull(),
    status: text("status"),
  },
  (t) => [index("ad_sets_campaign_idx").on(t.campaignId)],
);

export const ads = pgTable(
  "ads",
  {
    id: text("id").primaryKey(),
    adSetId: text("ad_set_id").notNull(),
    campaignId: text("campaign_id").notNull(),
    accountId: text("account_id").notNull(),
    name: text("name").notNull(),
    status: text("status"),
    thumbnailUrl: text("thumbnail_url"),
    body: text("body"),
    title: text("title"),
  },
  (t) => [index("ads_campaign_idx").on(t.campaignId)],
);

/**
 * One row per day × ad × publisher platform. All dashboard numbers are sums
 * over this table; ratios (CTR, CPC, ROAS…) are derived after summing.
 */
export const insights = pgTable(
  "insights",
  {
    date: date("date", { mode: "string" }).notNull(),
    accountId: text("account_id").notNull(),
    campaignId: text("campaign_id").notNull(),
    adSetId: text("ad_set_id").notNull(),
    adId: text("ad_id").notNull(),
    platform: text("platform").notNull(),
    spend: doublePrecision("spend").notNull().default(0),
    impressions: doublePrecision("impressions").notNull().default(0),
    reach: doublePrecision("reach").notNull().default(0),
    clicks: doublePrecision("clicks").notNull().default(0),
    linkClicks: doublePrecision("link_clicks").notNull().default(0),
    landingPageViews: doublePrecision("landing_page_views").notNull().default(0),
    purchases: doublePrecision("purchases").notNull().default(0),
    purchaseValue: doublePrecision("purchase_value").notNull().default(0),
    addToCart: doublePrecision("add_to_cart").notNull().default(0),
    initiateCheckout: doublePrecision("initiate_checkout").notNull().default(0),
    leads: doublePrecision("leads").notNull().default(0),
    videoViews: doublePrecision("video_views").notNull().default(0),
    thruplays: doublePrecision("thruplays").notNull().default(0),
    postEngagement: doublePrecision("post_engagement").notNull().default(0),
  },
  (t) => [
    uniqueIndex("insights_grain_uq").on(t.date, t.adId, t.platform),
    index("insights_account_date_idx").on(t.accountId, t.date),
    index("insights_campaign_date_idx").on(t.campaignId, t.date),
  ],
);

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").$type<"windsor" | "demo">().notNull(),
  status: text("status").$type<"running" | "success" | "error">().notNull().default("running"),
  dateFrom: date("date_from", { mode: "string" }).notNull(),
  dateTo: date("date_to", { mode: "string" }).notNull(),
  rows: integer("rows").notNull().default(0),
  error: text("error"),
  triggeredBy: text("triggered_by"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(clientMembers),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  members: many(clientMembers),
  accounts: many(clientAccounts),
  campaigns: many(clientCampaigns),
}));

export const clientMembersRelations = relations(clientMembers, ({ one }) => ({
  client: one(clients, { fields: [clientMembers.clientId], references: [clients.id] }),
  user: one(users, { fields: [clientMembers.userId], references: [users.id] }),
}));

export const clientAccountsRelations = relations(clientAccounts, ({ one }) => ({
  client: one(clients, { fields: [clientAccounts.clientId], references: [clients.id] }),
}));

export const clientCampaignsRelations = relations(clientCampaigns, ({ one }) => ({
  client: one(clients, { fields: [clientCampaigns.clientId], references: [clients.id] }),
}));

export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
