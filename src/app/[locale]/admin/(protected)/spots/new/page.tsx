import { getTranslations } from "next-intl/server";
import { SpotForm } from "@/components/admin/SpotForm";

export default async function NewSpotPage() {
  const t = await getTranslations("admin.spotForm");
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-heading text-2xl font-extrabold">{t("titleNew")}</h1>
      <SpotForm />
    </div>
  );
}
