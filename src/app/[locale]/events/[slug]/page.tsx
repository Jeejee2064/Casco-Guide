import { notFound } from "next/navigation";

// Events feature temporarily hidden site-wide — this route is disabled
// rather than deleted so it can be restored by uncommenting below.
// See also: Header, Hero, home page.tsx, admin Sidebar/dashboard,
// admin/(protected)/events/*.
export default function EventDetailPage() {
  notFound();
}

// import type { Metadata } from "next";
// import { setRequestLocale } from "next-intl/server";
// import { Header } from "@/components/site/Header";
// import { Footer } from "@/components/site/Footer";
// import { EventDetailView } from "@/components/site/EventDetailView";
// import { getEventBySlug, getNearbyEvents } from "@/lib/data/events";
// import { getSpotById, getNearbySpots } from "@/lib/data/spots";
// import type { Locale } from "@/i18n/routing";
//
// export async function generateMetadata({
//   params,
// }: {
//   params: Promise<{ locale: string; slug: string }>;
// }): Promise<Metadata> {
//   const { locale, slug } = (await params) as { locale: Locale; slug: string };
//   const event = await getEventBySlug(slug, locale);
//   if (!event) return {};
//
//   return {
//     title: `${event.title} — Casco Guide`,
//     description: event.description ?? undefined,
//   };
// }
//
// export default async function EventDetailPage({
//   params,
// }: {
//   params: Promise<{ locale: string; slug: string }>;
// }) {
//   const { locale, slug } = (await params) as { locale: Locale; slug: string };
//   setRequestLocale(locale);
//
//   const event = await getEventBySlug(slug, locale);
//   if (!event) notFound();
//
//   const hostSpot = event.spot_id ? await getSpotById(event.spot_id, locale) : null;
//
//   const [nearbySpots, nearbyEvents] = await Promise.all([
//     getNearbySpots(event.latitude, event.longitude, locale, {
//       excludeId: hostSpot?.id,
//       limit: 6,
//     }),
//     getNearbyEvents(event.latitude, event.longitude, locale, { excludeId: event.id, limit: 4 }),
//   ]);
//
//   return (
//     <>
//       <Header />
//       <main className="flex-1">
//         <EventDetailView
//           event={event}
//           hostSpot={hostSpot}
//           nearbySpots={nearbySpots}
//           nearbyEvents={nearbyEvents}
//         />
//       </main>
//       <Footer />
//     </>
//   );
// }
