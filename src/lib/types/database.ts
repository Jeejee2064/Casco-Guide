// Hand-written types mirroring supabase/migrations/0001_init.sql
// (Regenerate with `npx supabase gen types typescript` once the project is linked.)

export type SpotCategory =
  | "restaurant"
  | "bar"
  | "cafe"
  | "attraction"
  | "museum"
  | "shop"
  | "gallery"
  | "hotel";

export type EventCategory =
  | "cinema"
  | "dance"
  | "expo"
  | "kids"
  | "music"
  | "sports"
  | "theatre"
  | "workshop";

export type PriceRange = "$" | "$$" | "$$$" | "$$$$";
export type ParkingType = "street" | "paid-lot" | "none";
export type RecurrenceType = "once" | "daily" | "weekly" | "monthly";

export interface HourSlot {
  open: string; // "HH:MM"
  close: string; // "HH:MM"
}

export type DayHours = HourSlot[] | null;

export interface Photo {
  url: string;
  caption?: string;
}

export interface Spot {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  article: string | null;
  category: SpotCategory;

  latitude: number;
  longitude: number;
  address: string | null;
  neighborhood: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;

  hours_monday: DayHours;
  hours_tuesday: DayHours;
  hours_wednesday: DayHours;
  hours_thursday: DayHours;
  hours_friday: DayHours;
  hours_saturday: DayHours;
  hours_sunday: DayHours;
  hours_note: string | null;

  price_range: PriceRange | null;
  cuisine_type: string | null;
  dietary_options: string[];
  reservation_required: boolean;
  accepts_cards: boolean;
  parking: ParkingType | null;

  photos: Photo[];
  featured_photo: string | null;

  tags: string[];
  rating: number | null;
  review_count: number;
  is_featured: boolean;
  is_verified: boolean;

  created_at: string;
  updated_at: string;
  last_verified: string | null;
}

export interface EventRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  article: string | null;
  category: EventCategory;

  date: string;
  time_start: string;
  time_end: string | null;
  recurring: RecurrenceType | null;
  recurring_until: string | null;

  latitude: number;
  longitude: number;
  address: string | null;
  spot_id: string | null;

  capacity: number | null;
  price: number | null;
  booking_url: string | null;
  organizer: string | null;
  organizer_contact: string | null;

  photo: string | null;
  photos: Photo[];

  tags: string[];
  is_featured: boolean;
  is_verified: boolean;

  created_at: string;
  updated_at: string;
  last_verified: string | null;
}

// Raw bilingual rows, as stored in Supabase (`spots`/`events` tables).
// The admin forms read and write these directly. Everywhere else reads
// the locale-resolved `Spot`/`EventRow` shape above instead — see
// src/lib/i18n/content.ts for how one is derived from the other.

export interface SpotRecord
  extends Omit<Spot, "name" | "description" | "article" | "cuisine_type" | "hours_note"> {
  name_es: string;
  name_en: string;
  description_es: string | null;
  description_en: string | null;
  article_es: string | null;
  article_en: string | null;
  cuisine_type_es: string | null;
  cuisine_type_en: string | null;
  hours_note_es: string | null;
  hours_note_en: string | null;
}

export interface EventRecord extends Omit<EventRow, "title" | "description" | "article"> {
  title_es: string;
  title_en: string;
  description_es: string | null;
  description_en: string | null;
  article_es: string | null;
  article_en: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  emoji: string | null;
  description: string | null;
}

export const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

export const HOURS_COLUMN: Record<DayKey, keyof Spot> = {
  monday: "hours_monday",
  tuesday: "hours_tuesday",
  wednesday: "hours_wednesday",
  thursday: "hours_thursday",
  friday: "hours_friday",
  saturday: "hours_saturday",
  sunday: "hours_sunday",
};
