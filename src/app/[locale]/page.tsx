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
// How many (highest-rated) spots each homepage teaser leads with — the full
// set lives one click away on /spots (grid) and /map.
const FEATURED_SPOTS_COUNT = 6;
const MAP_TEASER_SPOTS_COUNT = 12;

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

  // Highest-rated first — powers both spot-facing teasers below.
  // `is_featured` is currently unset for every spot (see the SpotCard/
  // SpotMap comments this mirrors), so rating is the only real "which
  // spots to lead with" signal available today.
  const ratedSpots = [...spots].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero eventsCount={0} />

        {/* Latest guides come right after the fold — the hero itself stays
            a clean, single-viewport "pick what you're here for" moment (see
            Hero's own comment), and this is the first thing that scrolls
            into view under it. */}
        <div className="border-t border-border">
          <LatestGuidesSection articles={articles.slice(0, HOME_ARTICLES_COUNT)} />
        </div>

        {/* Content-forward homepage: history/context, then a teaser into
            each of the three real ways to browse (grid, map, vibes) — the
            grid and map themselves moved out to their own /spots and /map
            pages (see AGENTS-adjacent commit) so this page reads as
            substantial, crawlable text rather than mostly an app shell. */}

        <div className="border-t border-border">
          <VibeTeaserSection />
        </div>
        <div className="border-t border-border">
          <FeaturedSpotsSection
            spots={ratedSpots.slice(0, FEATURED_SPOTS_COUNT)}
            totalCount={spots.length}
          />
        </div>

        <div className="border-t border-border">
          <MapTeaserSection spots={ratedSpots.slice(0, MAP_TEASER_SPOTS_COUNT)} />
        </div>

        <AboutIntro />

        <div className="border-t border-border">
          <AboutFaq />
        </div>
      </main>
      <Footer />
    </>
  );
}
