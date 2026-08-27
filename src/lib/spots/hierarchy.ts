import type { Spot } from "@/lib/types/database";

/** Splits a flat spot list into top-level spots and a parent id → children
 * lookup — the one place that defines "who's a hub, who's inside it" for
 * the map, spot detail pages, and the admin table/form to share. Pure — no
 * query, just a grouping of whatever list is already in hand, so it's safe
 * to import from both server and client components (unlike lib/data/spots.ts,
 * which pulls in the server-only Supabase client). */
export function groupSpotsByParent(spots: Spot[]): {
  topLevel: Spot[];
  childrenByParent: Map<string, Spot[]>;
} {
  const childrenByParent = new Map<string, Spot[]>();
  for (const spot of spots) {
    if (!spot.parent_id) continue;
    const siblings = childrenByParent.get(spot.parent_id);
    if (siblings) siblings.push(spot);
    else childrenByParent.set(spot.parent_id, [spot]);
  }
  const topLevel = spots.filter((spot) => !spot.parent_id);
  return { topLevel, childrenByParent };
}
