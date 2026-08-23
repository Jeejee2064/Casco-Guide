import {
  Utensils,
  Martini,
  Coffee,
  Landmark,
  Building2,
  ShoppingBag,
  Palette,
  Bed,
  type LucideIcon,
} from "lucide-react";
import type { SpotCategory } from "@/lib/types/database";

// 8-swatch brand palette, one color per category, no repeats.
export const CATEGORY_META: Record<SpotCategory, { color: string; icon: LucideIcon }> = {
  restaurant: { color: "#f44336", icon: Utensils }, // red
  bar: { color: "#ad1457", icon: Martini }, // deep pink
  cafe: { color: "#ffc107", icon: Coffee }, // amber
  attraction: { color: "#8bc34a", icon: Landmark }, // light green
  museum: { color: "#1565c0", icon: Building2 }, // dark blue
  shop: { color: "#ff9800", icon: ShoppingBag }, // orange
  gallery: { color: "#009688", icon: Palette }, // teal
  hotel: { color: "#448aff", icon: Bed }, // blue
};

export const SPOT_CATEGORIES = Object.keys(CATEGORY_META) as SpotCategory[];
