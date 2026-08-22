import type { Locale } from "@/i18n/routing";

// Central SEO constants. NEXT_PUBLIC_SITE_URL lets staging/preview deploys
// override the canonical production domain without touching code.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://cascoviejo.guide").replace(
  /\/+$/,
  "",
);

export const SITE_NAME = "Casco Viejo Guide";

// Site-wide fallback Open Graph image (the logo mark on the brand teal) —
// every spot/article page overrides it with its own photo when it has one.
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

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
