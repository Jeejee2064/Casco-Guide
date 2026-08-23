import { PartyPopper, Laptop, Sunset, ScrollText, ChefHat, Palette, type LucideIcon } from "lucide-react";
import type { Spot, SpotVibe } from "@/lib/types/database";

/**
 * A second, orthogonal classification axis for spots, alongside
 * `CATEGORY_META` in ./categories.ts — same shape, same convention.
 * Unlike category, a spot can carry several vibes at once (see the
 * `vibes` column on Spot), so this palette also needs to read well
 * as several simultaneous chips, not just one.
 *
 * Colors are the 6-swatch brand palette (Electric Indigo, Azure Blue,
 * Malachite, Saffron, Tomato, Hot Fuchsia) — one per vibe, no repeats.
 * `icon` (Lucide) is the one glyph language used everywhere a vibe
 * renders — chips, map pins, VibesModal — no emoji anywhere in the app.
 */
export const VIBE_META: Record<SpotVibe, { color: string; icon: LucideIcon }> = {
  rooftop_party: { color: "#F82553", icon: PartyPopper }, // Hot Fuchsia
  nomad_work: { color: "#2C7CE5", icon: Laptop }, // Azure Blue
  romantic_sunset: { color: "#FB6640", icon: Sunset }, // Tomato
  local_heritage: { color: "#6434E9", icon: ScrollText }, // Electric Indigo
  gastro_trendy: { color: "#F8C421", icon: ChefHat }, // Saffron
  // Enum id kept as `chill_coffee` (no schema/data-shape change) but this
  // slot was re-scoped from "cafe hangout" to "Arts & Culture" — it was
  // functionally a duplicate of nomad_work's "WiFi • Coworking • Good
  // coffee" (same cafes qualified for both), leaving no real distinction on
  // the map/chips. Galleries, theatre, museums and live-music venues give
  // it its own ground the other 5 don't cover — see messages/*.json for the
  // label/descriptor and 0009_vibe_arts_culture_backfill.sql for the retag.
  chill_coffee: { color: "#49CC5C", icon: Palette }, // Malachite
};

export const SPOT_VIBES = Object.keys(VIBE_META) as SpotVibe[];

/**
 * Relevance score for ranking `spots` by how well they fit a selected vibe
 * (see VibesModal + SpotsExplorerSection) — a direct tag match dominates, rating
 * only breaks ties among otherwise-equal spots. Used to *reorder* the full
 * list (nothing gets excluded), unlike the category filter.
 */
export function vibeRelevanceScore(spot: Spot, vibeId: SpotVibe): number {
  let score = 0;
  if (spot.vibes.includes(vibeId)) score += 10;
  score += (spot.rating ?? 0) * 0.5;
  return score;
}
