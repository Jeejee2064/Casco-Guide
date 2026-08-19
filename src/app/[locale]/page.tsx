import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ExploreSection } from "@/components/site/ExploreSection";
import { EventCard } from "@/components/site/EventCard";
import { Hero } from "@/components/site/Hero";
import { Stagger, StaggerItem } from "@/components/site/motion";
import { getSpots } from "@/lib/data/spots";
import { getEvents } from "@/lib/data/events";
import type { Locale } from "@/i18n/routing";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);

  const [t, spots, events] = await Promise.all([
    getTranslations("site"),
    getSpots(locale),
    getEvents(locale),
  ]);
  const tEvents = await getTranslations("events");

  return (
    <>
      <Header />
      <main className="flex-1">
 

        <div id="explore" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-8 sm:px-6">
          {/* ExploreSection reads the `?view=map` query client-side (via
              useSearchParams) to open straight into the map when arriving
              from the "explore the full map" CTA — a Suspense boundary is
              required since this route is statically prerendered. */}
          <Suspense>
            <ExploreSection spots={spots} events={events} />
          </Suspense>
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
      </main>
      <Footer />
    </>
  );
}
