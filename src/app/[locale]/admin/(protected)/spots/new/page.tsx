import { getLocale, getTranslations } from "next-intl/server";
import { SpotForm } from "@/components/admin/SpotForm";
import { getSpots } from "@/lib/data/spots";
import type { Locale } from "@/i18n/routing";

export default async function NewSpotPage({
  searchParams,
}: {
  // Set by a hub's own edit page ("+ Créer un lieu enfant") to prefill the
  // new spot's parent and address/coordinates — see SpotForm's
  // `initialParentId` doc comment.
  searchParams: Promise<{ parent_id?: string }>;
}) {
  const t = await getTranslations("admin.spotForm");
  const locale = (await getLocale()) as Locale;
  const [{ parent_id }, allSpots] = await Promise.all([searchParams, getSpots(locale)]);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-heading text-2xl font-extrabold">{t("titleNew")}</h1>
      <SpotForm allSpots={allSpots} initialParentId={parent_id} />
    </div>
  );
}
