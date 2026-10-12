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
 * "related events" / spots rails. The CTA back to the full map lives right
 * under the MiniMap in the aside instead — see GetMeThereCard. Either rail
 * can be empty and just doesn't render; if both are empty there's nothing to
 * show at all.
 *
 * `origin` is the coordinate of the page being viewed (the spot or event
 * itself) — when `spotsAreNearby` is true, each spot card gets its own
 * walking-time badge computed straight-line from there, same math as the
 * MiniMap/itinerary walk times (see lib/geo.ts); it's the page's own
 * coordinate, not the visitor's, so unlike MiniMap's distance badge it never
 * needs geolocation permission.
 *
 * `spotsAreNearby` also picks the rail's heading: proximity-sorted spots
 * (the default, used by the event detail page) read as "Nearby spots", while
 * the spot detail page passes `false` for its category/vibe-matched "you
 * might also like" rail (see getRelatedSpots) — those picks aren't sorted by
 * distance, so a walk-time badge there would be misleading.
 */
export function NearbySection({
  nearbySpots = [],
  nearbyEvents = [],
  origin,
  spotsAreNearby = true,
}: {
  nearbySpots?: Spot[];
  nearbyEvents?: EventRow[];
  origin: { lat: number; lng: number };
  spotsAreNearby?: boolean;
}) {
  const t = useTranslations("discover");
  const router = useRouter();

  if (nearbySpots.length === 0 && nearbyEvents.length === 0) return null;

  return (
    <div className="isolate relative mt-12 py-8 sm:mt-16 sm:py-10">
      {/* Full-bleed to the viewport edge regardless of this component's own
          nesting inside the page's `max-w-6xl` column — see `.section-surface`
          in globals.css for why this rail needs a visibly different surface
          from the gallery/info sections above it, not just a border. */}
      <div
        aria-hidden
        className="section-surface absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 border-y border-border"
      />
      <div className="space-y-10">
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
            <h2 className="font-heading mb-4 text-xl font-extrabold">
              {t(spotsAreNearby ? "nearbySpots" : "relatedSpots")}
            </h2>
            <Stagger className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {nearbySpots.map((spot) => (
                <StaggerItem key={spot.id} className="w-[240px] shrink-0 sm:w-[260px]">
                  <SpotCard
                    spot={spot}
                    walkMinutes={
                      spotsAreNearby
                        ? walkingMinutes(
                            haversineKm(origin.lat, origin.lng, spot.latitude, spot.longitude),
                          )
                        : undefined
                    }
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
    </div>
  );
}
