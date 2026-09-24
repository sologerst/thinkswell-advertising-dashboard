import type { GoalType } from "@/lib/db/schema";

/** Raw, additive columns stored in `insights`. */
export const BASE_FIELDS = [
  "spend",
  "impressions",
  "reach",
  "clicks",
  "linkClicks",
  "landingPageViews",
  "purchases",
  "purchaseValue",
  "addToCart",
  "initiateCheckout",
  "leads",
  "videoViews",
  "thruplays",
  "postEngagement",
] as const;

export type BaseField = (typeof BASE_FIELDS)[number];
export type Totals = Record<BaseField, number>;

export function emptyTotals(): Totals {
  return Object.fromEntries(BASE_FIELDS.map((f) => [f, 0])) as Totals;
}

export function addTotals(into: Totals, row: Partial<Totals>) {
  for (const f of BASE_FIELDS) into[f] += Number(row[f] ?? 0);
  return into;
}

export type MetricFormat = "currency" | "number" | "percent" | "multiplier" | "decimal";
export type Accent = "cyan" | "gold" | "purple" | "coral";

export type MetricDef = {
  key: string;
  label: string;
  short: string;
  help: string;
  format: MetricFormat;
  /** Whether an increase is good news for the client. */
  better: "up" | "down" | "neutral";
  accent: Accent;
  icon: string;
  /** Cost-type metrics are hidden when a client has spend hidden (future option). */
  isCost?: boolean;
  compute: (t: Totals) => number | null;
};

const div = (a: number, b: number) => (b > 0 ? a / b : null);

export const METRICS: MetricDef[] = [
  {
    key: "spend",
    label: "Ad spend",
    short: "Spend",
    help: "What Meta billed for ads in this period (Facebook + Instagram).",
    format: "currency",
    better: "neutral",
    accent: "cyan",
    icon: "wallet",
    isCost: true,
    compute: (t) => t.spend,
  },
  {
    key: "revenue",
    label: "Revenue",
    short: "Revenue",
    help: "Purchase value attributed to your ads by the Meta pixel / Conversions API.",
    format: "currency",
    better: "up",
    accent: "gold",
    icon: "dollar",
    compute: (t) => t.purchaseValue,
  },
  {
    key: "roas",
    label: "ROAS",
    short: "ROAS",
    help: "Return on ad spend: revenue ÷ ad spend. 5.0x means $5 back for every $1 spent.",
    format: "multiplier",
    better: "up",
    accent: "gold",
    icon: "rocket",
    compute: (t) => div(t.purchaseValue, t.spend),
  },
  {
    key: "purchases",
    label: "Purchases",
    short: "Purchases",
    help: "Tickets, orders or bookings completed after someone saw or clicked an ad.",
    format: "number",
    better: "up",
    accent: "purple",
    icon: "ticket",
    compute: (t) => t.purchases,
  },
  {
    key: "costPerPurchase",
    label: "Cost per purchase",
    short: "Cost / purchase",
    help: "Ad spend ÷ purchases.",
    format: "currency",
    better: "down",
    accent: "coral",
    icon: "tag",
    isCost: true,
    compute: (t) => div(t.spend, t.purchases),
  },
  {
    key: "aov",
    label: "Avg. order value",
    short: "AOV",
    help: "Revenue ÷ purchases.",
    format: "currency",
    better: "up",
    accent: "gold",
    icon: "receipt",
    compute: (t) => div(t.purchaseValue, t.purchases),
  },
  {
    key: "addToCart",
    label: "Adds to cart",
    short: "Add to cart",
    help: "People who added tickets or products to their cart.",
    format: "number",
    better: "up",
    accent: "cyan",
    icon: "cart",
    compute: (t) => t.addToCart,
  },
  {
    key: "initiateCheckout",
    label: "Checkouts started",
    short: "Checkouts",
    help: "People who began checkout.",
    format: "number",
    better: "up",
    accent: "cyan",
    icon: "creditCard",
    compute: (t) => t.initiateCheckout,
  },
  {
    key: "leads",
    label: "Leads",
    short: "Leads",
    help: "Form fills and inquiries from Instant Forms or your website.",
    format: "number",
    better: "up",
    accent: "purple",
    icon: "inbox",
    compute: (t) => t.leads,
  },
  {
    key: "cpl",
    label: "Cost per lead",
    short: "CPL",
    help: "Ad spend ÷ leads.",
    format: "currency",
    better: "down",
    accent: "coral",
    icon: "tag",
    isCost: true,
    compute: (t) => div(t.spend, t.leads),
  },
  {
    key: "leadRate",
    label: "Lead rate",
    short: "Lead rate",
    help: "Leads ÷ link clicks: how often a click becomes a lead.",
    format: "percent",
    better: "up",
    accent: "cyan",
    icon: "funnel",
    compute: (t) => div(t.leads, t.linkClicks),
  },
  {
    key: "reach",
    label: "Reach",
    short: "Reach",
    help: "People who saw your ads, added up day by day (someone reached on two days counts twice).",
    format: "number",
    better: "up",
    accent: "cyan",
    icon: "users",
    compute: (t) => t.reach,
  },
  {
    key: "impressions",
    label: "Impressions",
    short: "Impressions",
    help: "Times your ads were shown on screen.",
    format: "number",
    better: "up",
    accent: "purple",
    icon: "eye",
    compute: (t) => t.impressions,
  },
  {
    key: "frequency",
    label: "Frequency",
    short: "Frequency",
    help: "Average times each person saw your ads per day (impressions ÷ daily reach).",
    format: "decimal",
    better: "neutral",
    accent: "gold",
    icon: "repeat",
    compute: (t) => div(t.impressions, t.reach),
  },
  {
    key: "cpm",
    label: "CPM",
    short: "CPM",
    help: "Cost per 1,000 impressions.",
    format: "currency",
    better: "down",
    accent: "coral",
    icon: "tag",
    isCost: true,
    compute: (t) => (t.impressions > 0 ? (t.spend / t.impressions) * 1000 : null),
  },
  {
    key: "videoViews",
    label: "Video views",
    short: "Views (3s)",
    help: "Video plays of at least 3 seconds.",
    format: "number",
    better: "up",
    accent: "purple",
    icon: "play",
    compute: (t) => t.videoViews,
  },
  {
    key: "thruplays",
    label: "ThruPlays",
    short: "ThruPlays",
    help: "Video plays to completion, or 15+ seconds for longer videos.",
    format: "number",
    better: "up",
    accent: "gold",
    icon: "film",
    compute: (t) => t.thruplays,
  },
  {
    key: "costPerThruplay",
    label: "Cost per ThruPlay",
    short: "Cost / ThruPlay",
    help: "Ad spend ÷ ThruPlays.",
    format: "currency",
    better: "down",
    accent: "coral",
    icon: "tag",
    isCost: true,
    compute: (t) => div(t.spend, t.thruplays),
  },
  {
    key: "linkClicks",
    label: "Link clicks",
    short: "Link clicks",
    help: "Clicks that took people to your website, ticket page or app.",
    format: "number",
    better: "up",
    accent: "purple",
    icon: "pointer",
    compute: (t) => t.linkClicks,
  },
  {
    key: "ctr",
    label: "Click-through rate",
    short: "CTR",
    help: "Link clicks ÷ impressions.",
    format: "percent",
    better: "up",
    accent: "cyan",
    icon: "percent",
    compute: (t) => div(t.linkClicks, t.impressions),
  },
  {
    key: "cpc",
    label: "Cost per click",
    short: "CPC",
    help: "Ad spend ÷ link clicks.",
    format: "currency",
    better: "down",
    accent: "coral",
    icon: "tag",
    isCost: true,
    compute: (t) => div(t.spend, t.linkClicks),
  },
  {
    key: "landingPageViews",
    label: "Landing page views",
    short: "LPVs",
    help: "Clicks where your page actually finished loading.",
    format: "number",
    better: "up",
    accent: "gold",
    icon: "globe",
    compute: (t) => t.landingPageViews,
  },
  {
    key: "costPerLpv",
    label: "Cost per LPV",
    short: "Cost / LPV",
    help: "Ad spend ÷ landing page views.",
    format: "currency",
    better: "down",
    accent: "coral",
    icon: "tag",
    isCost: true,
    compute: (t) => div(t.spend, t.landingPageViews),
  },
  {
    key: "postEngagement",
    label: "Engagements",
    short: "Engagements",
    help: "Reactions, comments, shares, saves and clicks on your ads.",
    format: "number",
    better: "up",
    accent: "cyan",
    icon: "heart",
    compute: (t) => t.postEngagement,
  },
];

export const METRIC_MAP: Record<string, MetricDef> = Object.fromEntries(METRICS.map((m) => [m.key, m]));

export function getMetric(key: string): MetricDef | undefined {
  return METRIC_MAP[key];
}

export type GoalPreset = {
  goal: GoalType;
  label: string;
  tagline: string;
  emoji: string;
  /** The "result" a campaign is judged on, for tables and day cards. */
  result: string;
  costPerResult: string;
  kpis: string[];
};

export const GOAL_PRESETS: Record<GoalType, GoalPreset> = {
  sales: {
    goal: "sales",
    label: "Ticket sales / E-com",
    tagline: "Tickets, orders and revenue",
    emoji: "🎟️",
    result: "purchases",
    costPerResult: "costPerPurchase",
    kpis: ["revenue", "roas", "purchases", "costPerPurchase", "ctr", "addToCart"],
  },
  leads: {
    goal: "leads",
    label: "Lead generation",
    tagline: "Inquiries, bookings and sign-ups",
    emoji: "📬",
    result: "leads",
    costPerResult: "cpl",
    kpis: ["leads", "cpl", "leadRate", "linkClicks", "ctr", "cpm"],
  },
  awareness: {
    goal: "awareness",
    label: "Awareness / Video",
    tagline: "Reach, views and attention",
    emoji: "📣",
    result: "thruplays",
    costPerResult: "costPerThruplay",
    kpis: ["reach", "impressions", "thruplays", "videoViews", "cpm", "frequency"],
  },
  traffic: {
    goal: "traffic",
    label: "Traffic / Engagement",
    tagline: "Clicks, visits and engagement",
    emoji: "⚡",
    result: "linkClicks",
    costPerResult: "cpc",
    kpis: ["linkClicks", "ctr", "cpc", "landingPageViews", "postEngagement", "costPerLpv"],
  },
};

export const GOALS = Object.values(GOAL_PRESETS);
