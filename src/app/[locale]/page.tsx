import type { Metadata } from "next";
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ExploreSection } from "@/components/site/ExploreSection";
import { ExploreViewProvider } from "@/components/site/ExploreViewContext";
import { ExploreFilterProvider } from "@/components/site/ExploreFilterContext";
// Events temporarily hidden site-wide — see the commented block below.
// import { EventCard } from "@/components/site/EventCard";
import { AboutCascoViejo } from "@/components/site/AboutCascoViejo";
import { Hero } from "@/components/site/Hero";
import { InstallPwaPrompt } from "@/components/site/InstallPwaPrompt";
// import { Stagger, StaggerItem } from "@/components/site/motion";
import { getSpots } from "@/lib/data/spots";
// import { getEvents } from "@/lib/data/events";
import { getArticles } from "@/lib/data/articles";
import { buildAlternates } from "@/lib/seo/alternates";
import type { Locale } from "@/i18n/routing";

// How many of the latest published articles to feature on the home page —
// the rest are one click away via the "see all articles" link to /articles.
const HOME_ARTICLES_COUNT = 3;

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

  const [spots, articles] = await Promise.all([
    getSpots(locale),
    // getEvents(locale),
    getArticles(locale),
  ]);
  // const tEvents = await getTranslations("events");

  return (
    // ExploreViewProvider reads the `?view=map` query client-side (via
    // useSearchParams) so both Header and ExploreSection can open straight
    // into the map when arriving from the "explore the full map" CTA — a
    // Suspense boundary is required since this route is statically
    // prerendered. It wraps Header too: Header hides its own nav and shows a
    // back button while the map's open, which needs the same state.
    <Suspense>
      <ExploreViewProvider>
        <Header />
        <main className="flex-1">
          <Hero
            spotsCount={spots.length}
            eventsCount={0}
            articlesCount={articles.length}
            articles={articles.slice(0, HOME_ARTICLES_COUNT)}
          />

          <div id="explore" className="scroll-mt-20">
            {/* events prop intentionally omitted — events hidden site-wide, see AGENTS note */}
            <ExploreFilterProvider>
              <ExploreSection spots={spots} />
            </ExploreFilterProvider>
          </div>

          {/* Events section hidden site-wide — keep in sync with the fetch above
              and with Header/Hero's events links when re-enabling.
          {events.length > 0 && (
            <div id="events" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16 sm:px-6">
              <h2 className="font-heading mb-4 text-2xl font-extrabold">{tEvents("title")}</h2>
              <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2" amount={0.05}>
                {events.map((event) => (
                  <StaggerItem key={event.id}>
                    <EventCard event={event} />
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          )}
          */}

          <div className="border-t border-border">
            <AboutCascoViejo />
          </div>
        </main>
        <Footer />
        <InstallPwaPrompt />
      </ExploreViewProvider>
    </Suspense>
  );
}
