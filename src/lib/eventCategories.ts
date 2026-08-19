import type { EventCategory } from "@/lib/types/database";

/**
 * Full-color badge icons in /public/icons — unlike CATEGORY_META's
 * Lucide icons (spots), these are pre-colored SVGs, not tinted
 * via currentColor. `color` is only used for text/badge accents.
 */
export const EVENT_CATEGORY_META: Record<
  EventCategory,
  { color: string; icon: string }
> = {
  cinema: { color: "#A14B42", icon: "/icons/cinema.svg" },
  dance: { color: "#8B4A6B", icon: "/icons/dance.svg" },
  expo: { color: "#B8862E", icon: "/icons/expo.svg" },
  kids: { color: "#3F7D5C", icon: "/icons/kids.svg" },
  music: { color: "#5B5A8C", icon: "/icons/music.svg" },
  sports: { color: "#3A6EA5", icon: "/icons/sports.svg" },
  theatre: { color: "#6E4F8C", icon: "/icons/theatre.svg" },
  workshop: { color: "#B5573A", icon: "/icons/workshop.svg" },
};

export const EVENT_CATEGORIES = Object.keys(EVENT_CATEGORY_META) as EventCategory[];
