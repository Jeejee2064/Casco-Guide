import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { FoliageTrail } from "@/components/site/Foliage";
import { Footer } from "@/components/site/Footer";
import { JsonLd } from "@/components/site/JsonLd";
import { SpotDetailView } from "@/components/site/SpotDetailView";
import { getSpots, getSpotBySlug, getRelatedSpots, getSpotById, getChildSpots } from "@/lib/data/spots";
// Events temporarily hidden site-wide — see the commented block below.
// import { getNearbyEvents } from "@/lib/data/events";
import { getArticlesForSpot } from "@/lib/data/articles";
import { buildAlternates } from "@/lib/seo/alternates";
import { breadcrumbSchema, spotSchema, webPageSchema } from "@/lib/seo/schema";
import { shareImageUrl, SHARE_IMAGE_META, SITE_NAME } from "@/lib/seo/site";
import { socialMetadata, truncate } from "@/lib/seo/metadata";
import { routing, type Locale } from "@/i18n/routing";

// Prerender every spot at build time (both locales); a spot added later is
// rendered on first request and cached, and saves expire the cache.
export async function generateStaticParams() {
  const spots = await getSpots("es");
  return routing.locales.flatMap((locale) => spots.map((spot) => ({ locale, slug: spot.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const spot = await getSpotBySlug(slug, locale);
  if (!spot) return {};

  const [t, tCategory] = await Promise.all([
    getTranslations({ locale, namespace: "seo" }),
    getTranslations({ locale, namespace: "category" }),
  ]);
  const category = tCategory(spot.category);
  const title = t("spotTitle", { name: spot.name, category });
  const description = truncate(
    spot.description ?? t("spotDescriptionFallback", { name: spot.name, category }),
  );
  const alternates = buildAlternates({ pathname: "/spots/[slug]", params: { slug } }, locale);

  return {
    title,
    description,
    alternates,
    ...socialMetadata({
      locale,
      title,
      description,
      url: alternates?.canonical as string,
      image: {
        url: shareImageUrl("spots", slug, locale, spot.updated_at),
        alt: spot.name,
        ...SHARE_IMAGE_META,
      },
    }),
  };
}

export default async function SpotDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  setRequestLocale(locale);

  const spot = await getSpotBySlug(slug, locale);
  if (!spot) notFound();

  const [articles, t, tCategory, parentSpot, childSpots] = await Promise.all([
    // getNearbyEvents(spot.latitude, spot.longitude, locale, { limit: 4 }),
    getArticlesForSpot(spot.id, locale),
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "category" }),
    // A spot has at most one of these two — see SpotDetailView's doc comment.
    spot.parent_id ? getSpotById(spot.parent_id, locale) : Promise.resolve(null),
    getChildSpots(spot.id, locale),
  ]);

  // Run after the hub lookups above (not folded into that Promise.all) since
  // it needs their ids to exclude the parent/sibling spots already shown in
  // the "part of"/"places here" sections from the "you might also like" rail.
  const relatedSpots = await getRelatedSpots(spot, locale, {
    excludeIds: [parentSpot?.id, ...childSpots.map((c) => c.id)].filter((id): id is string => Boolean(id)),
    limit: 6,
  });

  const url = buildAlternates({ pathname: "/spots/[slug]", params: { slug } }, locale)!.canonical as string;
  const spotsUrl = buildAlternates("/spots", locale)!.canonical as string;
  const homeUrl = buildAlternates("/", locale)!.canonical as string;
  // Breadcrumb items must be real, crawlable pages — the category level has
  // no page of its own, so it is left out rather than pointing at an anchor.
  const breadcrumbs = breadcrumbSchema([
    { name: SITE_NAME, url: homeUrl },
    { name: t("spots"), url: spotsUrl },
    { name: spot.name, url },
  ]);

  return (
    <>
      <JsonLd data={spotSchema(spot, url)} />
      <JsonLd
        data={webPageSchema({
          url,
          name: spot.name,
          description: spot.description ?? undefined,
          locale,
          dateModified: spot.updated_at,
          lastReviewed: spot.last_verified,
          mainEntityId: `${url}#place`,
        })}
      />
      <JsonLd data={breadcrumbs} />
      <Header />
      <main className="relative isolate flex-1 overflow-clip">
        <FoliageTrail seed={`spot-${slug}`} />
        <SpotDetailView
          spot={spot}
          nearbySpots={relatedSpots}
          // nearbyEvents intentionally omitted — events hidden site-wide
          articles={articles}
          parentSpot={parentSpot}
          childSpots={childSpots}
        />
      </main>
      <Footer />
    </>
  );
}
