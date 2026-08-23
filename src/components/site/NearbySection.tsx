"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { SpotCard } from "./SpotCard";
import { EventCard } from "./EventCard";
import { Stagger, StaggerItem } from "./motion";
import { haversineKm, walkingMinutes } from "@/lib/geo";
import type { EventRow, Spot } from "@/lib/types/database";

/**
 * Bottom-of-page "keep browsing" block for a spot or event detail page:
 * "related events" / "nearby spots" rails. The CTA back to the full map
 * lives right under the MiniMap in the aside instead — see ExploreMapCard.
 * Either rail can be empty and just doesn't render; if both are empty there's
 * nothing to show at all.
 *
 * `origin` is the coordinate of the page being viewed (the spot or event
 * itself) — each nearby spot card gets its own walking-time badge computed
 * straight-line from there, same math as the MiniMap/itinerary walk times
 * (see lib/geo.ts). It's the page's own coordinate, not the visitor's, so
 * unlike MiniMap's distance badge it never needs geolocation permission.
 */
export function NearbySection({
  nearbySpots = [],
  nearbyEvents = [],
  origin,
}: {
  nearbySpots?: Spot[];
  nearbyEvents?: EventRow[];
  origin: { lat: number; lng: number };
}) {
  const t = useTranslations("discover");
  const router = useRouter();

  if (nearbySpots.length === 0 && nearbyEvents.length === 0) return null;

  return (
    <div className="mt-12 space-y-10 border-t border-border pt-8 sm:mt-16 sm:pt-10">
      {nearbyEvents.length > 0 && (
        <section>
          <h2 className="font-heading mb-4 text-xl font-extrabold">{t("relatedEvents")}</h2>
          <Stagger className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {nearbyEvents.map((event) => (
              <StaggerItem key={event.id} className="w-[320px] shrink-0 sm:w-[360px]">
                <EventCard event={event} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}

      {nearbySpots.length > 0 && (
        <section>
          <h2 className="font-heading mb-4 text-xl font-extrabold">{t("nearbySpots")}</h2>
          <Stagger className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {nearbySpots.map((spot) => (
              <StaggerItem key={spot.id} className="w-[240px] shrink-0 sm:w-[260px]">
                <SpotCard
                  spot={spot}
                  walkMinutes={walkingMinutes(
                    haversineKm(origin.lat, origin.lng, spot.latitude, spot.longitude),
                  )}
                  onClick={() =>
                    router.push({ pathname: "/spots/[slug]", params: { slug: spot.slug } })
                  }
                />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      )}
    </div>
  );
}
