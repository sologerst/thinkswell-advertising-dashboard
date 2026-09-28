import type { TargetingSpec } from "@/lib/db/schema";
import { titleCase } from "@/lib/format";

/**
 * Turns Meta's ad set targeting spec (synced as JSON from Windsor's
 * `adset_targeting`) into plain-English rows for the campaign page.
 * Spec reference: https://developers.facebook.com/docs/marketing-api/audiences/reference/basic-targeting
 * Everything is read defensively: unknown keys are ignored, odd shapes skipped.
 */

export type TargetingRowKind = "locations" | "people" | "audiences" | "interests" | "excluding" | "placements";

export type TargetingRow = {
  kind: TargetingRowKind;
  label: string;
  /** Each inner list means "any of these"; separate lists must all match (Meta's "narrow further"). */
  groups: string[][];
  note?: string;
};

export type TargetingSummary = {
  rows: TargetingRow[];
  /** Advantage+ audience lets Meta reach people outside these settings. */
  advantageAudience: boolean;
};

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
const nonEmpty = (groups: string[][]) => groups.filter((g) => g.length > 0);
const uniq = (items: string[]) => [...new Set(items)];

/** Names from a list of `{ id, name }` objects (or plain strings). */
function names(v: unknown): string[] {
  return list(v)
    .map((x) => (isObj(x) ? text(x.name) : text(x)))
    .filter((s): s is string => Boolean(s));
}

/** Custom audience names; any Meta sent without a name are counted instead of dropped. */
function audienceNames(v: unknown): string[] {
  const named = names(v);
  const unnamed = list(v).length - named.length;
  return unnamed > 0 ? [...named, `${unnamed} ${named.length ? "other " : ""}audience${unnamed === 1 ? "" : "s"}`] : named;
}

let regionNames: Intl.DisplayNames | null = null;
function countryName(code: string) {
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function radius(o: Obj) {
  const r = typeof o.radius === "number" ? o.radius : Number(o.radius);
  if (!Number.isFinite(r) || r <= 0) return "";
  return ` +${r} ${o.distance_unit === "kilometer" ? "km" : "mi"}`;
}

function geoNames(geo: unknown): string[] {
  if (!isObj(geo)) return [];
  const out: string[] = [];
  for (const c of list(geo.countries)) if (text(c)) out.push(countryName(text(c)!));
  for (const r of list(geo.regions)) if (isObj(r) && text(r.name)) out.push(text(r.name)!);
  for (const m of list(geo.geo_markets)) if (isObj(m) && text(m.name)) out.push(`${text(m.name)} (DMA)`);
  for (const c of list(geo.cities)) {
    if (!isObj(c) || !text(c.name)) continue;
    const region = text(c.region);
    out.push(`${text(c.name)}${region ? `, ${region}` : ""}${radius(c)}`);
  }
  for (const key of ["neighborhoods", "subcities", "metro_areas", "large_geo_areas", "medium_geo_areas", "small_geo_areas", "electoral_districts"]) {
    for (const x of list(geo[key])) if (isObj(x) && text(x.name)) out.push(text(x.name)!);
  }
  for (const z of list(geo.zips)) {
    const name = isObj(z) ? (text(z.name) ?? text(z.key)?.replace(/^[A-Z]{2}:/, "")) : text(z);
    if (name) out.push(name);
  }
  for (const p of list(geo.places)) if (isObj(p) && text(p.name)) out.push(`${text(p.name)}${radius(p)}`);
  for (const p of list(geo.custom_locations)) {
    if (!isObj(p)) continue;
    const label = text(p.address_string) ?? text(p.name);
    const lat = Number(p.latitude);
    const lng = Number(p.longitude);
    if (label) out.push(`${label}${radius(p)}`);
    else if (Number.isFinite(lat) && Number.isFinite(lng)) out.push(`Pin at ${lat.toFixed(2)}, ${lng.toFixed(2)}${radius(p)}`);
  }
  return out;
}

function locationNote(geo: unknown) {
  if (!isObj(geo)) return undefined;
  const types = list(geo.location_types).map(text);
  if (types.includes("travel_in")) return "People traveling in these places";
  if (types.length === 1 && types[0] === "home") return "People who live in these places";
  if (types.length === 1 && types[0] === "recent") return "People recently in these places";
  return undefined;
}

function ageLabel(spec: Obj) {
  const min = Number(spec.age_min) || 18;
  const max = Number(spec.age_max) || 65;
  return max >= 65 ? `Ages ${min}–65+` : `Ages ${min}–${max}`;
}

function genderLabel(spec: Obj) {
  const g = list(spec.genders).map(Number);
  if (g.length === 1 && g[0] === 1) return "Men";
  if (g.length === 1 && g[0] === 2) return "Women";
  return "All genders";
}

// Detailed-targeting categories whose entries carry a `name` (numeric-coded ones are skipped).
const DETAILED_KEYS = [
  "interests",
  "behaviors",
  "life_events",
  "family_statuses",
  "industries",
  "income",
  "work_positions",
  "work_employers",
  "education_schools",
  "education_majors",
  "user_adclusters",
];

function detailedNames(o: unknown): string[] {
  if (!isObj(o)) return [];
  return DETAILED_KEYS.flatMap((k) => names(o[k]));
}

const PLATFORMS: Record<string, { label: string; positionsKey: string }> = {
  facebook: { label: "Facebook", positionsKey: "facebook_positions" },
  instagram: { label: "Instagram", positionsKey: "instagram_positions" },
  messenger: { label: "Messenger", positionsKey: "messenger_positions" },
  audience_network: { label: "Audience Network", positionsKey: "audience_network_positions" },
  threads: { label: "Threads", positionsKey: "threads_positions" },
};

const POSITIONS: Record<string, string> = {
  feed: "Feed",
  stream: "Feed",
  threads_stream: "Feed",
  story: "Stories",
  facebook_reels: "Reels",
  reels: "Reels",
  facebook_reels_overlay: "Reels overlays",
  profile_reels: "Profile reels",
  video_feeds: "Video feeds",
  instream_video: "In-stream video",
  marketplace: "Marketplace",
  search: "Search results",
  ig_search: "Search results",
  right_hand_column: "Right column",
  explore: "Explore",
  explore_home: "Explore home",
  profile_feed: "Profile feed",
  notification: "Notifications",
  messenger_home: "Inbox",
  sponsored_messages: "Sponsored messages",
  classic: "Native & banner",
  rewarded_video: "Rewarded video",
};

function placements(spec: Obj): string[] {
  const platforms = list(spec.publisher_platforms).map(text).filter((s): s is string => Boolean(s));
  const out = platforms.length
    ? platforms.map((p) => {
        const def = PLATFORMS[p];
        const positions = [...new Set(list(spec[def?.positionsKey ?? `${p}_positions`]).map((x) => POSITIONS[String(x)] ?? titleCase(String(x))))];
        return `${def?.label ?? titleCase(p)} · ${positions.length ? positions.join(", ") : "All placements"}`;
      })
    : ["Advantage+ placements (Meta picks where ads show)"];
  const devices = list(spec.device_platforms).map(text);
  if (devices.length === 1 && devices[0] === "mobile") out.push("Mobile only");
  if (devices.length === 1 && devices[0] === "desktop") out.push("Desktop only");
  return out;
}

export function summarizeTargeting(spec: TargetingSpec | null | undefined): TargetingSummary | null {
  if (!isObj(spec)) return null;
  const rows: TargetingRow[] = [];

  const locations = geoNames(spec.geo_locations);
  if (locations.length) rows.push({ kind: "locations", label: "Locations", groups: [locations], note: locationNote(spec.geo_locations) });

  rows.push({ kind: "people", label: "People", groups: [[ageLabel(spec), genderLabel(spec)]] });

  const audiences = audienceNames(spec.custom_audiences);
  if (audiences.length) rows.push({ kind: "audiences", label: "Audiences", groups: [audiences] });

  // flexible_spec entries are ANDed together; items inside one entry are ORed.
  const interestGroups = nonEmpty([...list(spec.flexible_spec).map(detailedNames), detailedNames(spec)]);
  if (interestGroups.length) {
    rows.push({
      kind: "interests",
      label: "Interests",
      groups: interestGroups,
      note: spec.targeting_optimization === "expansion_all" ? "Meta may also reach people beyond these interests" : undefined,
    });
  }

  const excluding = [...audienceNames(spec.excluded_custom_audiences), ...detailedNames(spec.exclusions), ...geoNames(spec.excluded_geo_locations)];
  if (excluding.length) rows.push({ kind: "excluding", label: "Excluding", groups: [excluding] });

  rows.push({ kind: "placements", label: "Placements", groups: [placements(spec)] });

  const automation = isObj(spec.targeting_automation) ? spec.targeting_automation : {};
  return { rows: rows.map((r) => ({ ...r, groups: r.groups.map(uniq) })), advantageAudience: Number(automation.advantage_audience) === 1 };
}

const OPTIMIZATION_GOALS: Record<string, string> = {
  OFFSITE_CONVERSIONS: "conversions",
  VALUE: "purchase value",
  LEAD_GENERATION: "leads",
  QUALITY_LEAD: "quality leads",
  QUALITY_CALL: "calls",
  CONVERSATIONS: "conversations",
  LANDING_PAGE_VIEWS: "landing page views",
  LINK_CLICKS: "link clicks",
  POST_ENGAGEMENT: "engagement",
  PAGE_LIKES: "Page likes",
  EVENT_RESPONSES: "event responses",
  THRUPLAY: "ThruPlays",
  TWO_SECOND_CONTINUOUS_VIDEO_VIEWS: "2-second video views",
  REACH: "reach",
  IMPRESSIONS: "impressions",
  AD_RECALL_LIFT: "ad recall lift",
  APP_INSTALLS: "app installs",
  VISIT_INSTAGRAM_PROFILE: "Instagram profile visits",
  REMINDERS_SET: "reminders",
};

/** "OFFSITE_CONVERSIONS" → "conversions" (for "Optimized for …"). */
export function optimizationGoalLabel(goal: string | null | undefined) {
  if (!goal) return null;
  return OPTIMIZATION_GOALS[goal.toUpperCase()] ?? titleCase(goal).toLowerCase();
}
