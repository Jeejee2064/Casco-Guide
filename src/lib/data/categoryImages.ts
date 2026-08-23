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
// `?auto=format&fit=crop&w=1600&q=80` caps what Next's image optimizer has
// to fetch and re-encode at source — without it, Unsplash serves each of
// these at its full original resolution (several MB) on every cache miss,
// even though no card ever renders one past ~800px wide. 1600 covers 2x
// pixel-density screens at the widest slot these appear in (SpotCard's
// 33vw); the optimizer still resizes/converts down further from there per
// device via `sizes`.
export const CATEGORY_IMAGES: Record<SpotCategory, string> = {
  restaurant: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1600&q=80",
  bar: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1600&q=80",
  cafe: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1600&q=80",
  attraction: "https://images.unsplash.com/photo-1669697226220-e52a72a25ab1?auto=format&fit=crop&w=1600&q=80",
  museum: "https://images.unsplash.com/photo-1491156855053-9cdff72c7f85?auto=format&fit=crop&w=1600&q=80",
  gallery: "https://images.unsplash.com/photo-1605429523419-d828acb941d9?auto=format&fit=crop&w=1600&q=80",
  shop: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80",
  hotel: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=80",
};

/** Homepage hero banner photo, served locally from /public. */
export const HERO_IMAGE = "/hero.webp";

/** Best available image for a spot card: its own photo, else a category placeholder. */
export function getSpotImage(spot: Pick<Spot, "featured_photo" | "category">): string {
  return spot.featured_photo ?? CATEGORY_IMAGES[spot.category];
}

/** True only when the image is a real, uploaded photo of the venue. */
export function hasRealPhoto(spot: Pick<Spot, "featured_photo">): boolean {
  return Boolean(spot.featured_photo);
}
