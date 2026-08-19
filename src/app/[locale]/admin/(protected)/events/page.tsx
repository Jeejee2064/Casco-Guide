import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { EventsTable } from "@/components/admin/EventsTable";
import { getEvents } from "@/lib/data/events";
import type { Locale } from "@/i18n/routing";

export default async function AdminEventsPage() {
  const t = await getTranslations("admin.events");
  const locale = (await getLocale()) as Locale;
  const events = await getEvents(locale);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold">{t("title")}</h1>
          <p className="text-sm text-foreground/60">{t("subtitle")}</p>
        </div>
        <Link href="/admin/events/new">
          <Button variant="coral">+ {t("add")}</Button>
        </Link>
      </div>

      <EventsTable events={events} />
    </div>
  );
}
