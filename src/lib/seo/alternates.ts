import type { Metadata } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { absoluteUrl } from "./site";

type Href = Parameters<typeof getPathname>[0]["href"];

/** Builds the `alternates` block (canonical + hreflang) for one route across
 * every locale, given the route expressed once (as a next-intl `href`, same
 * shape used by `<Link>`) plus the locale currently being rendered. Every
 * page-level `generateMetadata` should call this so Google always sees a
 * canonical tag and a full set of `hreflang` alternates, including
 * `x-default` pointing at the default locale. */
export function buildAlternates(href: Href, locale: Locale): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = absoluteUrl(getPathname({ href, locale: l }));
  }
  languages["x-default"] = absoluteUrl(getPathname({ href, locale: routing.defaultLocale }));

  return {
    canonical: absoluteUrl(getPathname({ href, locale })),
    languages,
  };
}
