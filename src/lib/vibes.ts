import { PartyPopper, Laptop, Sunset, ScrollText, ChefHat, Coffee, type LucideIcon } from "lucide-react";
import type { SpotVibe } from "@/lib/types/database";

/**
 * A second, orthogonal classification axis for spots, alongside
 * `CATEGORY_META` in ./categories.ts — same shape, same convention.
 * Unlike category, a spot can carry several vibes at once (see the
 * `vibes` column on Spot), so this palette also needs to read well
 * as several simultaneous chips, not just one.
 */
export const VIBE_META: Record<SpotVibe, { color: string; icon: LucideIcon }> = {
  rooftop_party: { color: "#C4483F", icon: PartyPopper },
  nomad_work: { color: "#2F8577", icon: Laptop },
  romantic_sunset: { color: "#CC7A2E", icon: Sunset },
  local_heritage: { color: "#4B3F72", icon: ScrollText },
  gastro_trendy: { color: "#9B5030", icon: ChefHat },
  chill_coffee: { color: "#5C93B8", icon: Coffee },
};

export const SPOT_VIBES = Object.keys(VIBE_META) as SpotVibe[];
