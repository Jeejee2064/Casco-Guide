import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/admin/EventForm";
import { isSupabaseConfigured } from "@/lib/data/spots";
import { MOCK_EVENTS } from "@/lib/data/mock-events";
import type { EventRecord } from "@/lib/types/database";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("admin.eventForm");

  let event: EventRecord | null = null;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    event = data as EventRecord | null;
  } else {
    event = MOCK_EVENTS.find((e) => e.id === id) ?? null;
  }

  if (!event) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-heading text-2xl font-extrabold">{t("titleEdit")}</h1>
      <EventForm event={event} />
    </div>
  );
}
