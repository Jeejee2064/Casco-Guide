import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { SpotsTable } from "@/components/admin/SpotsTable";
import { getSpots } from "@/lib/data/spots";
import type { Locale } from "@/i18n/routing";

export default async function AdminSpotsPage() {
  const t = await getTranslations("admin.spots");
  const locale = (await getLocale()) as Locale;
  const spots = await getSpots(locale);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold">{t("title")}</h1>
          <p className="text-sm text-foreground/60">{t("subtitle")}</p>
        </div>
        <Link href="/admin/spots/new">
          <Button variant="primary">+ {t("add")}</Button>
        </Link>
      </div>

      <SpotsTable spots={spots} />
    </div>
  );
}
