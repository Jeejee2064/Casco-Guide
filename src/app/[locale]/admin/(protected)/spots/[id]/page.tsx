import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { SpotForm } from "@/components/admin/SpotForm";
import { isSupabaseConfigured, getSpots } from "@/lib/data/spots";
import { MOCK_SPOTS } from "@/lib/data/mock-spots";
import type { Locale } from "@/i18n/routing";
import type { SpotRecord } from "@/lib/types/database";

export default async function EditSpotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("admin.spotForm");
  const locale = (await getLocale()) as Locale;

  let spot: SpotRecord | null = null;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.from("spots").select("*").eq("id", id).maybeSingle();
    spot = data as SpotRecord | null;
  } else {
    spot = MOCK_SPOTS.find((s) => s.id === id) ?? null;
  }

  if (!spot) notFound();

  const allSpots = await getSpots(locale);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-heading text-2xl font-extrabold">{t("titleEdit")}</h1>
      <SpotForm spot={spot} allSpots={allSpots} />
    </div>
  );
}
