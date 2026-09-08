"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { DayHours, Photo, SpotRecord, SpotVibe } from "@/lib/types/database";

export interface SpotFormValues {
  id?: string;
  name_es: string;
  name_en: string;
  slug: string;
  description_es: string;
  description_en: string;
  article_es: string;
  article_en: string;
  category: SpotRecord["category"];
  vibes: SpotVibe[];
  latitude: number;
  longitude: number;
  address: string;
  neighborhood: string;
  phone: string;
  website: string;
  email: string;
  /** Set when this spot is one of several businesses inside a shared hub
   * location — the parent hub's id, or `null` for a standalone spot. */
  parent_id: string | null;
  hours_monday: DayHours;
  hours_tuesday: DayHours;
  hours_wednesday: DayHours;
  hours_thursday: DayHours;
  hours_friday: DayHours;
  hours_saturday: DayHours;
  hours_sunday: DayHours;
  hours_note_es: string;
  hours_note_en: string;
  price_range: SpotRecord["price_range"];
  cuisine_type_es: string;
  cuisine_type_en: string;
  dietary_options: string[];
  reservation_required: boolean;
  accepts_cards: boolean;
  parking: SpotRecord["parking"];
  photos: Photo[];
  featured_photo: string;
  tags: string[];
  is_featured: boolean;
  is_verified: boolean;
}

export async function upsertSpot(locale: Locale, values: SpotFormValues) {
  const supabase = await createClient();
  const { id, ...rest } = values;

  const payload = {
    ...rest,
    description_es: rest.description_es || null,
    description_en: rest.description_en || null,
    article_es: rest.article_es || null,
    article_en: rest.article_en || null,
    address: rest.address || null,
    neighborhood: rest.neighborhood || null,
    phone: rest.phone || null,
    website: rest.website || null,
    email: rest.email || null,
    hours_note_es: rest.hours_note_es || null,
    hours_note_en: rest.hours_note_en || null,
    cuisine_type_es: rest.cuisine_type_es || null,
    cuisine_type_en: rest.cuisine_type_en || null,
    featured_photo: rest.featured_photo || null,
    parent_id: rest.parent_id || null,
    last_verified: rest.is_verified ? new Date().toISOString() : null,
  };

  const { error, data } = id
    ? await supabase.from("spots").update(payload).eq("id", id).select("slug").single()
    : await supabase.from("spots").insert(payload).select("slug").single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/[locale]/admin/spots", "page");
  revalidatePath("/[locale]", "page");
  redirect({ href: "/admin/spots", locale });
  return { error: null, slug: data?.slug };
}

export async function deleteSpot(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("spots").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/[locale]/admin/spots", "page");
  return { error: null };
}

/** Attaches or detaches a child spot from a parent hub — a targeted update
 * for the admin "children" manager, so attaching/detaching doesn't require
 * resubmitting either spot's whole form. Pass `parentId: null` to detach. */
export async function setSpotParent(childId: string, parentId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.from("spots").update({ parent_id: parentId }).eq("id", childId);
  if (error) return { error: error.message };
  revalidatePath("/[locale]/admin/spots", "page");
  revalidatePath("/[locale]/admin/spots/[id]", "page");
  revalidatePath("/[locale]", "page");
  return { error: null };
}
