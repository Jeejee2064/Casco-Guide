import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { AboutIntro } from "@/components/site/AboutIntro";
import { AboutFaq } from "@/components/site/AboutFaq";
import { FeaturedSpotsSection } from "@/components/site/FeaturedSpotsSection";
import { MapTeaserSection } from "@/components/site/MapTeaserSection";
import { VibeTeaserSection } from "@/components/site/VibeTeaserSection";
import { LatestGuidesSection } from "@/components/site/LatestGuidesSection";
import { Hero } from "@/components/site/Hero";
import { getSpots } from "@/lib/data/spots";
import { getArticles } from "@/lib/data/articles";
import { buildAlternates } from "@/lib/seo/alternates";
import type { Locale } from "@/i18n/routing";

// How many of the latest published articles to feature on the home page —
// the rest are one click away via the "see all articles" link to /articles.
const HOME_ARTICLES_COUNT = 3;
// How many spots each homepage teaser leads with — the full set lives one
// click away on /spots (grid) and /map.
const FEATURED_SPOTS_COUNT = 6;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  // Title/description/OG already come from the root layout's
  // generateMetadata (same "seo.home" copy) — the home page only needs to
  // add its own canonical + hreflang alternates on top of that.
  return { alternates: buildAlternates("/", locale) };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);

  const [spots, articles] = await Promise.all([getSpots(locale), getArticles(locale)]);

  // Featured spots first — powers both spot-facing teasers below. Nothing
  // is currently marked `is_featured` (see the SpotCard/SpotMap comments
  // this mirrors), so until that's set from the admin this is a no-op and
  // both teasers just lead with `spots` in its existing order.
  const featuredFirst = [...spots].sort(
    (a, b) => Number(b.is_featured) - Number(a.is_featured),
  );

  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero spotsCount={spots.length} />

        {/* Order follows intent: the places themselves first (the thing
            people came for), then the editorial guides on a tinted band,
            then the vibe picker, the map as the page's one dark band, and
            finally the long-form context + FAQ that also give Google
            substantial crawlable text. */}
        <FeaturedSpotsSection
          spots={featuredFirst.slice(0, FEATURED_SPOTS_COUNT)}
          totalCount={spots.length}
        />

        <div className="border-y border-border bg-surface">
          <LatestGuidesSection articles={articles.slice(0, HOME_ARTICLES_COUNT)} />
        </div>

        <VibeTeaserSection />

        <MapTeaserSection spots={spots} />

        <AboutIntro />

        <div className="border-t border-border bg-surface">
          <AboutFaq />
        </div>
      </main>
      <Footer />
    </>
  );
}
