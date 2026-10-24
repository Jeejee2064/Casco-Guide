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
import { Foliage } from "@/components/site/Foliage";
import { TowerMark } from "@/components/site/TowerMark";
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
        {/* Foliage silhouettes sit in the background of each band — whisper-soft
            tints (see `--foliage*` in globals.css), cropped by the band's
            edges, behind the content. */}
        <div className="relative isolate overflow-hidden">
          <Foliage name="monstera" className="-right-24 -top-16 h-[22rem] w-[22rem] rotate-12 text-[var(--foliage)] sm:-right-10 sm:h-[30rem] sm:w-[30rem]" />
          <FeaturedSpotsSection
            spots={featuredFirst.slice(0, FEATURED_SPOTS_COUNT)}
            totalCount={spots.length}
          />
        </div>

        <div className="relative isolate overflow-hidden border-y border-border bg-surface">
          <Foliage name="heliconia" className="-left-16 -top-10 h-[20rem] w-[20rem] text-[var(--foliage)] sm:-left-8 sm:h-[26rem] sm:w-[26rem]" />
          <LatestGuidesSection articles={articles.slice(0, HOME_ARTICLES_COUNT)} />
        </div>

        <div className="relative isolate overflow-hidden">
          <Foliage name="heliconia" className="-bottom-10 -left-20 hidden h-[28rem] w-[28rem] -scale-x-100 text-[var(--foliage-green)] lg:block" />
          <VibeTeaserSection />
        </div>

        <div className="relative isolate overflow-hidden bg-[#0d0a17]">
          <Foliage name="monstera" className="-left-20 -top-16 h-[22rem] w-[22rem] -rotate-12 text-[var(--foliage-dark)] sm:h-[28rem] sm:w-[28rem]" />
          <MapTeaserSection spots={spots} />
        </div>

        <div className="relative isolate overflow-hidden">
          <Foliage name="bamboo" className="-right-20 -top-10 hidden h-[26rem] w-[26rem] text-[var(--foliage-green)] md:block" />
          <AboutIntro />
        </div>

        <div className="relative isolate overflow-hidden border-t border-border bg-surface">
          <TowerMark className="-bottom-10 left-[8%] hidden h-[22rem] w-[22rem] text-[var(--foliage)] opacity-50 lg:block" />
          <AboutFaq />
        </div>
      </main>
      <Footer />
    </>
  );
}
