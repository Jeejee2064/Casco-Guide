import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { SpotDetailView } from "@/components/site/SpotDetailView";
import { getSpotBySlug, getNearbySpots } from "@/lib/data/spots";
import { getNearbyEvents } from "@/lib/data/events";
import { getArticlesForSpot } from "@/lib/data/articles";
import type { Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const spot = await getSpotBySlug(slug, locale);
  if (!spot) return {};

  return {
    title: `${spot.name} — Casco Guide`,
    description: spot.description ?? undefined,
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

  const [nearbySpots, nearbyEvents, articles] = await Promise.all([
    getNearbySpots(spot.latitude, spot.longitude, locale, { excludeId: spot.id, limit: 6 }),
    getNearbyEvents(spot.latitude, spot.longitude, locale, { limit: 4 }),
    getArticlesForSpot(spot.id, locale),
  ]);

  return (
    <>
      <Header />
      <main className="flex-1">
        <SpotDetailView
          spot={spot}
          nearbySpots={nearbySpots}
          nearbyEvents={nearbyEvents}
          articles={articles}
        />
      </main>
      <Footer />
    </>
  );
}
