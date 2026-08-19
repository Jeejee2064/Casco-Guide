"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { EventRecord, Photo } from "@/lib/types/database";

export interface EventFormValues {
  id?: string;
  title_es: string;
  title_en: string;
  slug: string;
  description_es: string;
  description_en: string;
  article_es: string;
  article_en: string;
  category: EventRecord["category"];
  date: string;
  time_start: string;
  time_end: string;
  recurring: EventRecord["recurring"];
  recurring_until: string;
  latitude: number;
  longitude: number;
  address: string;
  spot_id: string;
  capacity: number | null;
  price: number | null;
  booking_url: string;
  organizer: string;
  organizer_contact: string;
  photo: string;
  photos: Photo[];
  tags: string[];
  is_featured: boolean;
  is_verified: boolean;
}

export async function upsertEvent(locale: Locale, values: EventFormValues) {
  const supabase = await createClient();
  const { id, ...rest } = values;

  const payload = {
    ...rest,
    description_es: rest.description_es || null,
    description_en: rest.description_en || null,
    article_es: rest.article_es || null,
    article_en: rest.article_en || null,
    time_end: rest.time_end || null,
    recurring_until: rest.recurring_until || null,
    address: rest.address || null,
    spot_id: rest.spot_id || null,
    booking_url: rest.booking_url || null,
    organizer: rest.organizer || null,
    organizer_contact: rest.organizer_contact || null,
    photo: rest.photo || null,
    last_verified: rest.is_verified ? new Date().toISOString() : null,
  };

  const { error } = id
    ? await supabase.from("events").update(payload).eq("id", id)
    : await supabase.from("events").insert(payload);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/[locale]/admin/events", "page");
  revalidatePath("/[locale]", "page");
  redirect({ href: "/admin/events", locale });
}

export async function deleteEvent(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/[locale]/admin/events", "page");
  return { error: null };
}
