import type { CreativeFields } from "@/lib/db/schema";

/**
 * Windsor fields describing an ad's creative, pulled in groups so one field
 * Windsor rejects doesn't lose the rest (see syncAccount).
 */
export const CREATIVE_FIELD_GROUPS = [
  ["object_type", "ad_preview_shareable_link", "instagram_permalink_url", "facebook_permalink_url"],
  ["effective_instagram_media__media_type", "effective_instagram_media__media_url", "effective_instagram_media__thumbnail_url"],
  ["image_url", "promoted_post_full_picture", "carousel_card_media_urls"],
] as const;

export const CREATIVE_FIELDS: string[] = CREATIVE_FIELD_GROUPS.flat();

export type CreativeKind = "video" | "image" | "carousel";

export type AdMedia = {
  kind: CreativeKind;
  /** Stills to try in order (Meta CDN links expire, so later ones are fallbacks). */
  stills: string[];
  /** One still per carousel card, in order. */
  cards: string[];
  /** Playable video file, when Meta exposes one. */
  video: string | null;
  /** Meta's shareable ad preview (works without a Facebook login). */
  previewUrl: string | null;
  /** The Instagram or Facebook post behind the ad. */
  postUrl: string | null;
};

/** Ads in these statuses aren't delivering and are listed under "Paused & ended". */
const OFF_STATUSES = new Set(["PAUSED", "ADSET_PAUSED", "CAMPAIGN_PAUSED", "COMPLETED", "ARCHIVED", "DELETED"]);

export function isAdOff(status: string | null | undefined) {
  return Boolean(status && OFF_STATUSES.has(status.toUpperCase()));
}

// Only ever render or link http(s) URLs from synced data.
function url(v: string | null | undefined) {
  if (!v) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

const uniq = (list: (string | null)[]) => [...new Set(list.filter((s): s is string => Boolean(s)))];

function kindFromName(name: string): CreativeKind {
  const n = name.toLowerCase();
  if (/(reel|video|trailer|story|ugc)/.test(n)) return "video";
  if (/carousel|collection/.test(n)) return "carousel";
  return "image";
}

export function adMedia(ad: { name: string; thumbnailUrl: string | null; creative: CreativeFields | null }): AdMedia {
  const c = ad.creative ?? {};
  const igType = c.effective_instagram_media__media_type?.toUpperCase() ?? null;
  const igMedia = url(c.effective_instagram_media__media_url);
  const igPoster = url(c.effective_instagram_media__thumbnail_url);
  const objectType = c.object_type?.toUpperCase() ?? null;
  const cards = uniq((c.carousel_card_media_urls ?? "").split(";").map(url));
  const image = url(c.image_url);
  const fullPicture = url(c.promoted_post_full_picture);
  const thumb = url(ad.thumbnailUrl);

  const kind: CreativeKind =
    igType === "VIDEO"
      ? "video"
      : igType === "CAROUSEL_ALBUM" || cards.length > 1
        ? "carousel"
        : igType === "IMAGE"
          ? "image"
          : objectType === "VIDEO"
            ? "video"
            : objectType === "PHOTO"
              ? "image"
              : kindFromName(ad.name);

  const stills =
    kind === "video"
      ? uniq([igPoster, fullPicture, image, thumb])
      : kind === "carousel"
        ? uniq([cards[0] ?? null, igMedia, fullPicture, image, thumb])
        : uniq([igType === "IMAGE" ? igMedia : null, image, fullPicture, thumb]);

  return {
    kind,
    stills,
    cards: kind === "carousel" ? cards : [],
    video: kind === "video" && igType === "VIDEO" ? igMedia : null,
    previewUrl: url(c.ad_preview_shareable_link),
    postUrl: url(c.instagram_permalink_url) ?? url(c.facebook_permalink_url),
  };
}
