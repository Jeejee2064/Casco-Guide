import { getLocale, getTranslations } from "next-intl/server";
import { MapPin, Newspaper, Clock } from "lucide-react";
// CalendarDays: only used by the events stat card below, currently commented out.
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { getSpots } from "@/lib/data/spots";
// Events temporarily hidden site-wide — see the commented stat card below.
// import { getEvents } from "@/lib/data/events";
import { getAllArticles } from "@/lib/data/articles";
import type { Locale } from "@/i18n/routing";

export default async function AdminDashboardPage() {
  const t = await getTranslations("admin.dashboard");
  const locale = (await getLocale()) as Locale;
  const [spots, articles] = await Promise.all([
    getSpots(locale),
    // getEvents(locale),
    getAllArticles(locale),
  ]);
  const lastUpdated = spots[0]?.updated_at
    ? new Date(spots[0].updated_at).toLocaleDateString()
    : "—";

  const stats = [
    {
      label: t("totalSpots"),
      value: spots.length,
      icon: MapPin,
      className: "bg-aqua/15 text-aqua-dark dark:text-aqua",
      href: "/admin/spots" as const,
    },
    // Events temporarily hidden site-wide — uncomment to restore this card.
    // {
    //   label: t("totalEvents"),
    //   value: events.length,
    //   icon: CalendarDays,
    //   className: "bg-coral/15 text-coral-dark dark:text-coral",
    //   href: "/admin/events" as const,
    // },
    {
      label: t("totalArticles"),
      value: articles.length,
      icon: Newspaper,
      className: "bg-magenta/15 text-magenta-dark dark:text-magenta",
      href: "/admin/articles" as const,
    },
    {
      label: t("lastUpdated"),
      value: lastUpdated,
      icon: Clock,
      className: "bg-lime/15 text-lime-dark dark:text-lime",
      href: null,
    },
  ] as const;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold">{t("title")}</h1>
          <p className="text-sm text-foreground/60">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/spots/new">
            <Button variant="primary">{t("addSpot")}</Button>
          </Link>
          {/* Events temporarily hidden site-wide — uncomment to restore. */}
          {/* <Link href="/admin/events/new">
            <Button variant="coral">{t("addEvent")}</Button>
          </Link> */}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, className, href }) => {
          const card = (
            <>
              <div
                className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${className}`}
              >
                <Icon size={18} />
              </div>
              <p className="font-heading text-2xl font-extrabold">{value}</p>
              <p className="text-sm text-foreground/60">{label}</p>
            </>
          );

          return href ? (
            <Link
              key={label}
              href={href}
              className="card-lift rounded-[var(--radius-card)] border border-border bg-surface p-5"
            >
              {card}
            </Link>
          ) : (
            <div
              key={label}
              className="rounded-[var(--radius-card)] border border-border bg-surface p-5"
            >
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}
