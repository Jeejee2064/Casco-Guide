import type { Spot, SpotCategory } from "@/lib/types/database";

/**
 * Curated fallback photography, keyed by spot category, used only when a
 * listing has no photo of its own (`featured_photo`/`photos` empty) — every
 * seeded Casco Viejo venue now has a distinct `featured_photo` set via
 * scripts/seed-casco-viejo.mjs, so this is a last-resort default for new
 * spots added without one. Sourced from Unsplash (free to use) and served
 * through `images.unsplash.com`, already allow-listed in `next.config.ts`.
 *
 * These are deliberately *not* real photos of the specific venue — they're
 * a tasteful category placeholder so cards never show a bare emoji.
 */
export const CATEGORY_IMAGES: Record<SpotCategory, string> = {
  restaurant: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5",
  bar: "https://images.unsplash.com/photo-1514933651103-005eec06c04b",
  cafe: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085",
  attraction: "https://images.unsplash.com/photo-1669697226220-e52a72a25ab1",
  museum: "https://images.unsplash.com/photo-1491156855053-9cdff72c7f85",
  gallery: "https://images.unsplash.com/photo-1605429523419-d828acb941d9",
  shop: "https://images.unsplash.com/photo-1441986300917-64674bd600d8",
  hotel: "https://images.unsplash.com/photo-1566073771259-6a8506099945",
};

/** Real Casco Viejo skyline at dusk — used for the homepage hero banner. */
export const HERO_IMAGE = "https://images.unsplash.com/photo-1587759301533-ae42d7065a80";

/** Best available image for a spot card: its own photo, else a category placeholder. */
export function getSpotImage(spot: Pick<Spot, "featured_photo" | "category">): string {
  return spot.featured_photo ?? CATEGORY_IMAGES[spot.category];
}

/** True only when the image is a real, uploaded photo of the venue. */
export function hasRealPhoto(spot: Pick<Spot, "featured_photo">): boolean {
  return Boolean(spot.featured_photo);
}
