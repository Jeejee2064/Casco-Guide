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

export const CATEGORY_META: Record<SpotCategory, { color: string; icon: LucideIcon }> = {
  restaurant: { color: "#B5573A", icon: Utensils },
  bar: { color: "#8B4A6B", icon: Martini },
  cafe: { color: "#3A6EA5", icon: Coffee },
  attraction: { color: "#3F7D5C", icon: Landmark },
  museum: { color: "#5B5A8C", icon: Building2 },
  shop: { color: "#B8862E", icon: ShoppingBag },
  gallery: { color: "#A14B42", icon: Palette },
  hotel: { color: "#1F6F6B", icon: Bed },
};

export const SPOT_CATEGORIES = Object.keys(CATEGORY_META) as SpotCategory[];
