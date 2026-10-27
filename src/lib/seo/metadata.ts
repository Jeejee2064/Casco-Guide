import type { Metadata } from "next";
import { routing, type Locale } from "@/i18n/routing";
import { DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGE_META, SITE_NAME, ogLocaleOf } from "./site";

/** Cuts text to `max` chars on a word boundary, with an ellipsis — search and
 * social previews truncate anyway, this just makes it clean and predictable. */
export function truncate(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/\s+\S*$/, "").trimEnd()}…`;
}

/** The `openGraph` + `twitter` blocks for a page. A page-level `openGraph`
 * replaces (never merges with) the root layout's, so every field — url,
 * site name, locale + alternates, image with dimensions/alt — is set here
 * for every page rather than assumed inherited. With no `image`, the
 * site-wide default card is used so no page ever shares without a picture. */
export function socialMetadata({
  locale,
  title,
  description,
  url,
  type = "website",
  image,
  openGraph,
}: {
  locale: Locale;
  title: string;
  description: string;
  url: string;
  type?: "website" | "article";
  image?: { url: string; alt: string; width: number; height: number; type: string };
  openGraph?: Record<string, unknown>;
}): Pick<Metadata, "openGraph" | "twitter"> {
  const card = image ?? {
    url: DEFAULT_OG_IMAGE,
    alt: SITE_NAME,
    ...DEFAULT_OG_IMAGE_META,
  };
  return {
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: ogLocaleOf(locale),
      alternateLocale: routing.locales.filter((l) => l !== locale).map(ogLocaleOf),
      type,
      images: [card],
      ...openGraph,
    } as Metadata["openGraph"],
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: card.url, alt: card.alt }],
    },
  };
}
