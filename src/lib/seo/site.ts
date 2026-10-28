import type { Locale } from "@/i18n/routing";

// Central SEO constants. NEXT_PUBLIC_SITE_URL lets staging/preview deploys
// override the canonical production domain without touching code.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://cascoviejo.guide").replace(
  /\/+$/,
  "",
);

export const SITE_NAME = "Casco Viejo Guide";

export const CONTACT_EMAIL = "contacto@cascoviejo.guide";

// Site-wide fallback Open Graph image (the logo mark on the brand teal) —
// every spot/article page overrides it with its own photo when it has one.
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;
export const DEFAULT_OG_IMAGE_META = { width: 1200, height: 650, type: "image/png" } as const;

/** Resolves a site-relative path (or passes through an already-absolute URL)
 * against SITE_URL — metadata fields that require a fully qualified URL
 * (canonical, hreflang, JSON-LD `url`/`image`) all go through this. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Open Graph uses underscore locale tags (`es_PA`), not BCP 47 (`es`) —
 * Panama-specific since the site's Spanish is aimed at that audience. */
export function ogLocaleOf(locale: Locale): string {
  return locale === "es" ? "es_PA" : "en_US";
}

/** Bump whenever the share card's look changes: it is part of both the image
 * URL (busting messenger/CDN caches) and the stored file name (so old-design
 * cards are never served again). */
export const SHARE_DESIGN_VERSION = 2;

/** Absolute URL of the generated 1200x630 share card for a spot/guide/event
 * (see app/api/og). `v` is the record's updated_at: editing a record changes
 * the URL, so WhatsApp/Facebook re-fetch instead of serving a stale preview. */
export function shareImageUrl(
  type: "spots" | "guides" | "events",
  slug: string,
  locale: Locale,
  updatedAt: string,
): string {
  const v = Date.parse(updatedAt) || 0;
  return `${SITE_URL}/api/og/${type}/${encodeURIComponent(slug)}?locale=${locale}&v=${v}&d=${SHARE_DESIGN_VERSION}`;
}

export const SHARE_IMAGE_META = { width: 1200, height: 630, type: "image/jpeg" } as const;
