import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ExploreSection } from "@/components/site/ExploreSection";
import { ExploreViewProvider } from "@/components/site/ExploreViewContext";
import { EventCard } from "@/components/site/EventCard";
import { ArticlesGrid } from "@/components/site/ArticlesGrid";
import { Hero } from "@/components/site/Hero";
import { Stagger, StaggerItem } from "@/components/site/motion";
import { Link } from "@/i18n/navigation";
import { getSpots } from "@/lib/data/spots";
import { getEvents } from "@/lib/data/events";
import { getArticles } from "@/lib/data/articles";
import type { Locale } from "@/i18n/routing";

// How many of the latest published articles to feature on the home page —
// the rest are one click away via the "see all articles" link to /articles.
const HOME_ARTICLES_COUNT = 3;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);

  const [spots, events, articles] = await Promise.all([
    getSpots(locale),
    getEvents(locale),
    getArticles(locale),
  ]);
  const tEvents = await getTranslations("events");
  const tArticles = await getTranslations("articles");

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
            eventsCount={events.length}
            articlesCount={articles.length}
          />

          <div id="explore" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-8 sm:px-6">
            <ExploreSection spots={spots} events={events} />
          </div>

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

          {articles.length > 0 && (
            <div id="articles" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16 sm:px-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-heading text-2xl font-extrabold">{tArticles("latestTitle")}</h2>
                <Link href="/articles" className="text-sm font-semibold text-aqua hover:underline">
                  {tArticles("seeAll")} →
                </Link>
              </div>
              <ArticlesGrid articles={articles.slice(0, HOME_ARTICLES_COUNT)} />
            </div>
          )}
        </main>
        <Footer />
      </ExploreViewProvider>
    </Suspense>
  );
}
