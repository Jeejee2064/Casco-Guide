import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getSpots } from "@/lib/data/spots";
import { getArticles } from "@/lib/data/articles";
import { absoluteUrl } from "@/lib/seo/site";

type Href = Parameters<typeof getPathname>[0]["href"];

/** One route, emitted once per locale with `alternates.languages` cross-
 * linking the other locale's version — the localized-sitemap pattern from
 * the Next.js docs (see sitemap.xml file-conventions reference). */
function localizedEntries(
  href: Href,
  opts: {
    changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
    priority: number;
    lastModified?: string;
    images?: string[];
  },
): MetadataRoute.Sitemap {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = absoluteUrl(getPathname({ href, locale }));
  }
  languages["x-default"] = absoluteUrl(getPathname({ href, locale: routing.defaultLocale }));

  return routing.locales.map((locale) => ({
    url: absoluteUrl(getPathname({ href, locale })),
    lastModified: opts.lastModified,
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
    ...(opts.images?.length && { images: opts.images }),
    alternates: { languages },
  }));
}

// Only slugs and timestamps are needed here, so one locale's worth of data
// is enough — spot/article slugs are the same across locales (see
// SpotRecord/ArticleRecord in lib/types/database.ts).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [spots, articles] = await Promise.all([
    getSpots(routing.defaultLocale),
    getArticles(routing.defaultLocale),
  ]);

  const newest = (dates: string[]) =>
    dates.length ? new Date(Math.max(...dates.map((d) => Date.parse(d)))).toISOString() : undefined;
  const spotsUpdated = newest(spots.map((s) => s.updated_at));
  const articlesUpdated = newest(articles.map((a) => a.updated_at));
  const siteUpdated = newest([spotsUpdated, articlesUpdated].filter((d): d is string => !!d));

  return [
    ...localizedEntries("/", { changeFrequency: "daily", priority: 1, lastModified: siteUpdated }),
    ...localizedEntries("/spots", { changeFrequency: "daily", priority: 0.9, lastModified: spotsUpdated }),
    ...localizedEntries("/map", { changeFrequency: "weekly", priority: 0.6, lastModified: spotsUpdated }),
    ...localizedEntries("/articles", { changeFrequency: "daily", priority: 0.8, lastModified: articlesUpdated }),
    ...spots.flatMap((spot) =>
      localizedEntries(
        { pathname: "/spots/[slug]", params: { slug: spot.slug } },
        {
          changeFrequency: "weekly",
          priority: 0.7,
          lastModified: spot.updated_at,
          images: [spot.featured_photo, ...spot.photos.map((p) => p.url)]
            .filter((u): u is string => !!u)
            .slice(0, 5)
            .map(absoluteUrl),
        },
      ),
    ),
    ...articles.flatMap((article) =>
      localizedEntries(
        { pathname: "/articles/[slug]", params: { slug: article.slug } },
        {
          changeFrequency: "monthly",
          priority: 0.6,
          lastModified: article.updated_at,
          images: article.cover_photo ? [absoluteUrl(article.cover_photo)] : [],
        },
      ),
    ),
  ];
}
