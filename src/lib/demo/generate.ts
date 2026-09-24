/**
 * Deterministic demo data, so the dashboard looks alive before Windsor is
 * connected. The same (ad, date) always produces the same numbers, which lets
 * us regenerate any window without the history shifting around.
 */
import { addDays, eachDay, fmtWeekday, type ISODate } from "@/lib/dates";

type Profile = "sales" | "leads" | "awareness" | "traffic";

type CampaignDef = {
  id: string;
  name: string;
  objective: string;
  profile: Profile;
  budget: number;
  /** Days ago the campaign started / ended (null = still running). */
  start: number;
  end: number | null;
  status: "ACTIVE" | "PAUSED" | "COMPLETED";
  /** Multiplier applied to conversion rates, so campaigns differ. */
  quality: number;
};

type AccountDef = { id: string; name: string; campaigns: CampaignDef[] };

export const DEMO_ACCOUNTS: AccountDef[] = [
  {
    id: "100100100",
    name: "Neon Mesa Music Hall",
    campaigns: [
      c("2001", "Fall Concert Series — Tickets", "OUTCOME_SALES", "sales", 420, 75, null, "ACTIVE", 1.1),
      c("2002", "Halloween Bash 2026 — Presale", "OUTCOME_SALES", "sales", 260, 21, null, "ACTIVE", 1.35),
      c("2003", "Retargeting — Cart Abandoners", "OUTCOME_SALES", "sales", 110, 110, null, "ACTIVE", 1.8),
      c("2004", "Jazz Brunch Sundays", "OUTCOME_SALES", "sales", 90, 118, 30, "COMPLETED", 0.8),
      c("2005", "Summer Rooftop Nights", "OUTCOME_SALES", "sales", 300, 119, 62, "COMPLETED", 0.95),
    ],
  },
  {
    id: "100100200",
    name: "Cumberland Social House",
    campaigns: [
      c("3001", "Private Events — Lead Form", "OUTCOME_LEADS", "leads", 180, 119, null, "ACTIVE", 1.1),
      c("3002", "Holiday Party Bookings 2026", "OUTCOME_LEADS", "leads", 240, 28, null, "ACTIVE", 1.3),
      c("3003", "Wedding Rehearsal Dinners", "OUTCOME_LEADS", "leads", 95, 90, null, "ACTIVE", 0.9),
      c("3004", "Rooftop Brunch — Awareness", "OUTCOME_AWARENESS", "awareness", 70, 60, 12, "PAUSED", 1),
    ],
  },
  {
    id: "100100300",
    name: "The Velvet Ramblers",
    campaigns: [
      c("4001", "New Single “Gravel Road” — Video Views", "OUTCOME_AWARENESS", "awareness", 150, 45, null, "ACTIVE", 1.2),
      c("4002", "Fall Tour Announce — Reach", "OUTCOME_AWARENESS", "awareness", 220, 33, null, "ACTIVE", 1),
      c("4003", "Tour Tickets — Retargeting Fans", "OUTCOME_SALES", "sales", 130, 33, null, "ACTIVE", 1.4),
      c("4004", "Fan Club Sign-ups", "OUTCOME_LEADS", "leads", 60, 100, 40, "COMPLETED", 1),
    ],
  },
  {
    id: "100100400",
    name: "Magnolia & Main Hotel",
    campaigns: [
      c("5001", "Book Direct — Website Traffic", "OUTCOME_TRAFFIC", "traffic", 160, 119, null, "ACTIVE", 1.1),
      c("5002", "Fall Weekend Getaways", "OUTCOME_TRAFFIC", "traffic", 210, 40, null, "ACTIVE", 1.25),
      c("5003", "Lobby Bar Happy Hour — Engagement", "OUTCOME_ENGAGEMENT", "traffic", 55, 80, null, "ACTIVE", 0.9),
    ],
  },
  {
    id: "100100500",
    name: "Thinkswell Sandbox",
    campaigns: [c("6001", "Creative Test — Q4 Concepts", "OUTCOME_TRAFFIC", "traffic", 40, 50, null, "ACTIVE", 1)],
  },
];

function c(
  id: string,
  name: string,
  objective: string,
  profile: Profile,
  budget: number,
  start: number,
  end: number | null,
  status: CampaignDef["status"],
  quality: number,
): CampaignDef {
  return { id, name, objective, profile, budget, start, end, status, quality };
}

const AUDIENCES: Record<Profile, string[]> = {
  sales: ["Nashville 21–45 · Live Music", "Lookalike 1% · Ticket Buyers", "Retargeting · Site Visitors 30d"],
  leads: ["Nashville Metro · Event Planners", "Lookalike 2% · Past Inquiries", "Retargeting · Engaged 60d"],
  awareness: ["Broad US · Country & Americana", "Fans of Similar Artists", "Tour Markets · 50mi Radius"],
  traffic: ["Drive Markets · 300mi", "Lookalike 1% · Past Guests", "Retargeting · Booking Engine 14d"],
};

const CREATIVES: Record<Profile, { name: string; title: string; body: string }[]> = {
  sales: [
    { name: "Reel — Crowd Energy 15s", title: "Tickets on sale now", body: "The loudest night in Nashville is back. Grab your spot before it sells out." },
    { name: "Carousel — Full Lineup", title: "See the full lineup", body: "Six nights. Twelve artists. One unforgettable fall." },
    { name: "Static — Date Card", title: "Limited tickets left", body: "Don't wait on this one — prices go up Friday." },
  ],
  leads: [
    { name: "Video — Venue Walkthrough", title: "Plan your private event", body: "Rooftop views, custom menus and a team that sweats the details." },
    { name: "Carousel — Event Spaces", title: "Get a quote in 60 seconds", body: "Tell us your date and headcount — we'll handle the rest." },
    { name: "Static — Testimonial", title: "“Best party we've thrown.”", body: "Join 300+ companies who've celebrated with us." },
  ],
  awareness: [
    { name: "Reel — Studio Session", title: "“Gravel Road” out now", body: "Turn it up. The new single from The Velvet Ramblers is streaming everywhere." },
    { name: "Video — Tour Trailer 30s", title: "Fall tour announced", body: "20 cities. One dusty van. Come sing along." },
    { name: "Static — Tour Poster", title: "Is your city on the list?", body: "Tickets on sale Friday at 10am local." },
  ],
  traffic: [
    { name: "Carousel — Suites", title: "Your Nashville weekend starts here", body: "Book direct for late checkout and a welcome cocktail." },
    { name: "Reel — Lobby Bar", title: "Happy hour, 4–7pm daily", body: "Craft cocktails, live piano, zero cover." },
    { name: "Static — Fall Rates", title: "Fall rates just dropped", body: "Save 20% on weekend stays through November." },
  ],
};

/* ---------- deterministic randomness ---------- */

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string) {
  let a = hashStr(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (r: () => number, lo: number, hi: number) => lo + (hi - lo) * r();

/* ---------- generation ---------- */

export type DemoData = ReturnType<typeof generateDemo>;

export function generateDemo(opts: { from: ISODate; to: ISODate; today: ISODate; todayFraction?: number }) {
  const accounts = DEMO_ACCOUNTS.map((a) => ({ id: a.id, name: a.name, currency: "USD", source: "demo" as const }));
  const campaigns: { id: string; accountId: string; name: string; status: string; objective: string; dailyBudget: number; startDate: string; endDate: string | null }[] = [];
  const adSets: { id: string; campaignId: string; accountId: string; name: string; status: string }[] = [];
  const ads: { id: string; adSetId: string; campaignId: string; accountId: string; name: string; status: string; title: string; body: string; thumbnailUrl: null }[] = [];
  const rows: Record<string, string | number>[] = [];

  for (const acct of DEMO_ACCOUNTS) {
    for (const camp of acct.campaigns) {
      const startDate = addDays(opts.today, -camp.start);
      const endDate = camp.end === null ? null : addDays(opts.today, -camp.end);
      campaigns.push({
        id: camp.id,
        accountId: acct.id,
        name: camp.name,
        status: camp.status,
        objective: camp.objective,
        dailyBudget: camp.budget,
        startDate,
        endDate,
      });

      const audiences = AUDIENCES[camp.profile];
      const creatives = CREATIVES[camp.profile];
      const setCount = camp.budget > 150 ? 3 : 2;
      for (let si = 0; si < setCount; si++) {
        const setId = `${camp.id}${si + 1}0`;
        const setWeight = [0.5, 0.3, 0.2][si]! * (setCount === 2 ? 1.25 : 1);
        adSets.push({ id: setId, campaignId: camp.id, accountId: acct.id, name: audiences[si]!, status: camp.status === "ACTIVE" ? "ACTIVE" : camp.status });
        const adCount = si === 0 ? 3 : 2;
        for (let ai = 0; ai < adCount; ai++) {
          const cr = creatives[(ai + si) % creatives.length]!;
          const adId = `${setId}${ai + 1}`;
          const winner = 1 + (hashStr(adId) % 5) * 0.12;
          ads.push({
            id: adId,
            adSetId: setId,
            campaignId: camp.id,
            accountId: acct.id,
            name: cr.name,
            status: camp.status === "ACTIVE" ? (ai === 2 ? "PAUSED" : "ACTIVE") : camp.status,
            title: cr.title,
            body: cr.body,
            thumbnailUrl: null,
          });
          const adWeight = (setWeight * [0.5, 0.3, 0.2][ai]!) / (adCount === 2 ? 0.8 : 1);

          for (const date of eachDay(opts.from, opts.to)) {
            if (date < startDate || (endDate && date > endDate)) continue;
            const r = rng(`${adId}|${date}`);
            const daysIn = eachDaySince(startDate, date);
            const ramp = Math.min(1, 0.45 + daysIn * 0.09);
            const wd = fmtWeekday(date);
            const weekday = { Mon: 0.82, Tue: 0.88, Wed: 0.95, Thu: 1.05, Fri: 1.22, Sat: 1.25, Sun: 0.98 }[wd] ?? 1;
            const partial = date === opts.today ? (opts.todayFraction ?? 0.5) : 1;
            const spend = camp.budget * adWeight * weekday * ramp * between(r, 0.82, 1.18) * partial;
            if (spend < 0.5) continue;

            const q = camp.quality * winner * between(r, 0.85, 1.15);
            const m = metricsFor(camp.profile, spend, q, r);
            const split = platformSplit(camp.profile, r);
            for (const [platform, share] of split) {
              const row: Record<string, string | number> = { date, accountId: acct.id, campaignId: camp.id, adSetId: setId, adId, platform };
              for (const [k, v] of Object.entries(m)) {
                const val = v * share * (platform === "instagram" ? igBias(camp.profile, k) : 1);
                row[k] = k === "spend" || k === "purchaseValue" ? round2(val) : stochasticRound(val, r);
              }
              rows.push(row);
            }
          }
        }
      }
    }
  }
  return { accounts, campaigns, adSets, ads, rows };
}

function eachDaySince(start: ISODate, date: ISODate) {
  return Math.max(0, Math.round((Date.parse(date) - Date.parse(start)) / 86_400_000));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Keeps small daily counts (e.g. 0.4 leads) honest in aggregate instead of rounding to zero.
function stochasticRound(n: number, r: () => number) {
  const f = Math.floor(n);
  return f + (r() < n - f ? 1 : 0);
}

function platformSplit(profile: Profile, r: () => number): [string, number][] {
  const ig = profile === "awareness" ? between(r, 0.5, 0.6) : between(r, 0.36, 0.46);
  const an = profile === "traffic" || profile === "awareness" ? 0.04 : 0;
  return [
    ["facebook", 1 - ig - an],
    ["instagram", ig],
    ...(an ? ([["audience_network", an]] as [string, number][]) : []),
  ];
}

// Instagram skews younger/more visual: a bit more engagement & video, slightly fewer leads.
function igBias(profile: Profile, key: string) {
  if (key === "postEngagement" || key === "videoViews" || key === "thruplays") return 1.15;
  if (key === "leads" && profile === "leads") return 0.9;
  return 1;
}

function metricsFor(profile: Profile, spend: number, q: number, r: () => number) {
  const cpm = { sales: 17, leads: 13, awareness: 6.5, traffic: 10 }[profile] * between(r, 0.85, 1.2);
  const impressions = (spend / cpm) * 1000;
  const reach = impressions / between(r, 1.08, 1.35);
  const ctr = { sales: 0.015, leads: 0.012, awareness: 0.006, traffic: 0.022 }[profile] * Math.sqrt(q);
  const linkClicks = impressions * ctr;
  const clicks = linkClicks * between(r, 1.6, 2.1);
  const landingPageViews = linkClicks * between(r, 0.72, 0.86);
  const postEngagement = impressions * between(r, 0.012, 0.03) * (profile === "awareness" ? 1.8 : 1);
  const videoViews = impressions * (profile === "awareness" ? between(r, 0.26, 0.34) : between(r, 0.08, 0.14));
  const thruplays = videoViews * between(r, 0.32, 0.42);

  let addToCart = 0;
  let initiateCheckout = 0;
  let purchases = 0;
  let purchaseValue = 0;
  let leads = 0;
  if (profile === "sales") {
    addToCart = landingPageViews * 0.14 * q;
    initiateCheckout = addToCart * between(r, 0.5, 0.62);
    purchases = initiateCheckout * between(r, 0.55, 0.68);
    purchaseValue = purchases * between(r, 48, 86);
  } else if (profile === "leads") {
    leads = linkClicks * 0.1 * q;
  } else if (profile === "traffic") {
    purchases = landingPageViews * 0.006 * q;
    purchaseValue = purchases * between(r, 260, 420);
  }
  return {
    spend,
    impressions,
    reach,
    clicks,
    linkClicks,
    landingPageViews,
    purchases,
    purchaseValue,
    addToCart,
    initiateCheckout,
    leads,
    videoViews,
    thruplays,
    postEngagement,
  };
}
