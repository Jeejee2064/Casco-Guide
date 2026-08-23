import { getLocale, getTranslations } from "next-intl/server";
import {
  MapPin,
  Newspaper,
  Clock,
  Users,
  Eye,
  Search,
  Download,
  TriangleAlert,
  MessageCircle,
  Navigation,
  Moon,
  Share2,
} from "lucide-react";
// CalendarDays: only used by the events stat card below, currently commented out.
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { getSpots } from "@/lib/data/spots";
// Events temporarily hidden site-wide — see the commented stat card below.
// import { getEvents } from "@/lib/data/events";
import { getAllArticles } from "@/lib/data/articles";
import type { Locale } from "@/i18n/routing";
import { RankedBarList } from "@/components/admin/RankedBarList";
import { AnalyticsStatTile } from "@/components/admin/AnalyticsStatTile";
import { PageviewTrendChart } from "@/components/admin/PageviewTrendChart";
import { SpotInteractionsTable, type SpotInteractionRow } from "@/components/admin/SpotInteractionsTable";
import {
  getAnalyticsSummary,
  getDeviceBreakdown,
  getEngagementCounts,
  getLanguageSplit,
  getNightModeStats,
  getPageviewTrend,
  getPageviewTrendToday,
  getPwaFunnel,
  getReferrers,
  getSearchStats,
  getSpotInteractionCounts,
  getTopArticles,
  getTopCategoryFilters,
  getTopSpots,
  getTopVibeFilters,
} from "@/lib/analytics/posthog-server";

// Fixed-order categorical palette — same four brand accents the dashboard's
// own stat cards already use as fixed roles, reused here for every
// categorical breakdown (device, language, referrers, filters) instead of a
// generated hue per slice.
const CATEGORICAL_COLORS = [
  "var(--color-aqua)",
  "var(--color-coral)",
  "var(--color-lime)",
  "var(--color-magenta)",
];

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="font-heading text-lg font-extrabold">{title}</h2>
      {subtitle && <p className="text-sm text-foreground/50">{subtitle}</p>}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const t = await getTranslations("admin.dashboard");
  const ta = await getTranslations("admin.analytics");
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

  // --- Analytics (below the fold on this same page — see the merge note
  // in the PR that combined the old standalone /admin/analytics route
  // into the dashboard) ---------------------------------------------------
  const isAnalyticsConfigured = Boolean(
    process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID,
  );

  let analytics: {
    summary: Awaited<ReturnType<typeof getAnalyticsSummary>>;
    trendToday: Awaited<ReturnType<typeof getPageviewTrendToday>>;
    trend7: Awaited<ReturnType<typeof getPageviewTrend>>;
    trend30: Awaited<ReturnType<typeof getPageviewTrend>>;
    topSpots: Awaited<ReturnType<typeof getTopSpots>>;
    topArticles: Awaited<ReturnType<typeof getTopArticles>>;
    spotInteractions: Awaited<ReturnType<typeof getSpotInteractionCounts>>;
    engagement: Awaited<ReturnType<typeof getEngagementCounts>>;
    topCategories: Awaited<ReturnType<typeof getTopCategoryFilters>>;
    topVibes: Awaited<ReturnType<typeof getTopVibeFilters>>;
    searchStats: Awaited<ReturnType<typeof getSearchStats>>;
    devices: Awaited<ReturnType<typeof getDeviceBreakdown>>;
    languages: Awaited<ReturnType<typeof getLanguageSplit>>;
    referrers: Awaited<ReturnType<typeof getReferrers>>;
    nightMode: Awaited<ReturnType<typeof getNightModeStats>>;
    pwaFunnel: Awaited<ReturnType<typeof getPwaFunnel>>;
  } | null = null;
  let analyticsError = false;

  if (isAnalyticsConfigured) {
    try {
      const [
        summary,
        trendToday,
        trend7,
        trend30,
        topSpots,
        topArticles,
        spotInteractions,
        engagement,
        topCategories,
        topVibes,
        searchStats,
        devices,
        languages,
        referrers,
        nightMode,
        pwaFunnel,
      ] = await Promise.all([
        getAnalyticsSummary(),
        getPageviewTrendToday(),
        getPageviewTrend(7),
        getPageviewTrend(30),
        getTopSpots(),
        getTopArticles(),
        getSpotInteractionCounts(),
        getEngagementCounts(),
        getTopCategoryFilters(),
        getTopVibeFilters(),
        getSearchStats(),
        getDeviceBreakdown(),
        getLanguageSplit(),
        getReferrers(),
        getNightModeStats(),
        getPwaFunnel(),
      ]);
      analytics = {
        summary,
        trendToday,
        trend7,
        trend30,
        topSpots,
        topArticles,
        spotInteractions,
        engagement,
        topCategories,
        topVibes,
        searchStats,
        devices,
        languages,
        referrers,
        nightMode,
        pwaFunnel,
      };
    } catch {
      analyticsError = true;
    }
  }

  // Every spot, PostHog's per-slug counts merged onto Supabase's spot list
  // (not the other way around) so a spot with zero interactions still gets
  // a row — that's the whole point of a ranking meant to tell a business
  // "you're #37", not just list who happened to show up in PostHog.
  const spotInteractionRows: SpotInteractionRow[] = analytics
    ? spots
        .map((spot) => {
          const c = analytics.spotInteractions[spot.slug] ?? {
            views: 0,
            whatsapp: 0,
            directions: 0,
            mapClicks: 0,
            shares: 0,
          };
          const total = c.views + c.whatsapp + c.directions + c.mapClicks + c.shares;
          return {
            id: spot.id,
            slug: spot.slug,
            name: spot.name,
            category: spot.category,
            vibes: spot.vibes,
            isFeatured: spot.is_featured,
            ...c,
            total,
          };
        })
        .sort((a, b) => b.total - a.total)
        .map((row, i) => ({ ...row, rank: i + 1 }))
    : [];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold">{t("title")}</h1>
          <p className="text-sm text-foreground/60">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/spots/new">
            <Button variant="primary">{t("addSpot")}</Button>
          </Link>
          <Link href="/admin/articles/new">
            <Button variant="magenta">{t("addArticle")}</Button>
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

      <div className="space-y-8 border-t border-border pt-8">
        <div>
          <h2 className="font-heading text-xl font-extrabold">{ta("title")}</h2>
          <p className="text-sm text-foreground/60">
            {ta("subtitle")} · {ta("windowLabel")}
          </p>
        </div>

        {!isAnalyticsConfigured && (
          <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-5 text-sm text-foreground/70">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-coral" />
            <p>{ta("notConfigured")}</p>
          </div>
        )}

        {isAnalyticsConfigured && analyticsError && (
          <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-5 text-sm text-foreground/70">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-coral" />
            <p>{ta("error")}</p>
          </div>
        )}

        {analytics && (
          <>
            {/* Overview */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <AnalyticsStatTile
                label={ta("uniqueVisitors")}
                value={analytics.summary.uniqueVisitors}
                icon={Users}
                className="bg-aqua/15 text-aqua-dark dark:text-aqua"
              />
              <AnalyticsStatTile
                label={ta("pageviews")}
                value={analytics.summary.pageviews}
                icon={Eye}
                className="bg-magenta/15 text-magenta-dark dark:text-magenta"
              />
              <AnalyticsStatTile
                label={ta("searches")}
                value={analytics.summary.searches}
                icon={Search}
                className="bg-coral/15 text-coral-dark dark:text-coral"
              />
              <AnalyticsStatTile
                label={ta("pwaInstalls")}
                value={analytics.summary.pwaInstalls}
                icon={Download}
                className="bg-lime/15 text-lime-dark dark:text-lime"
              />
            </div>

            {/* Interactions by spot — the ranking meant for pulling up a
                specific business and showing them exactly where they
                stand. */}
            <div className="space-y-4">
              <SectionHeading
                title={ta("interactionsSection")}
                subtitle={ta("interactionsSubtitle")}
              />
              <SpotInteractionsTable rows={spotInteractionRows} />
            </div>

            {/* Traffic trend */}
            <div className="space-y-4">
              <SectionHeading title={ta("trafficTrend")} subtitle={ta("trafficTrendSubtitle")} />
              <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
                <PageviewTrendChart
                  series={{
                    today: analytics.trendToday,
                    last7: analytics.trend7,
                    last30: analytics.trend30,
                  }}
                  labels={{
                    today: ta("rangeToday"),
                    last7: ta("rangeLast7"),
                    last30: ta("rangeLast30"),
                    empty: ta("empty"),
                  }}
                />
              </div>
            </div>

            {/* Most viewed content */}
            <div className="space-y-4">
              <SectionHeading title={ta("contentSection")} />
              <div className="grid gap-4 lg:grid-cols-2">
                <RankedBarList
                  title={ta("topSpots")}
                  items={analytics.topSpots}
                  emptyLabel={ta("empty")}
                />
                <RankedBarList
                  title={ta("topArticles")}
                  items={analytics.topArticles}
                  emptyLabel={ta("empty")}
                />
              </div>
            </div>

            {/* Engagement */}
            <div className="space-y-4">
              <SectionHeading title={ta("engagementSection")} subtitle={ta("engagementSubtitle")} />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <AnalyticsStatTile
                  label={ta("whatsappClicks")}
                  value={analytics.engagement.whatsappClicks}
                  icon={MessageCircle}
                  className="bg-[#25D366]/15 text-[#1a9e4b]"
                />
                <AnalyticsStatTile
                  label={ta("directionsClicks")}
                  value={analytics.engagement.directionsClicks}
                  icon={Navigation}
                  className="bg-aqua/15 text-aqua-dark dark:text-aqua"
                />
                <AnalyticsStatTile
                  label={ta("mapPinClicks")}
                  value={analytics.engagement.mapPinClicks}
                  icon={MapPin}
                  className="bg-magenta/15 text-magenta-dark dark:text-magenta"
                />
                <AnalyticsStatTile
                  label={ta("shareClicks")}
                  value={analytics.engagement.shareClicks}
                  icon={Share2}
                  className="bg-coral/15 text-coral-dark dark:text-coral"
                />
              </div>
            </div>

            {/* Discovery */}
            <div className="space-y-4">
              <SectionHeading title={ta("discoverySection")} subtitle={ta("discoverySubtitle")} />
              <div className="grid gap-4 lg:grid-cols-3">
                <RankedBarList
                  title={ta("topCategories")}
                  items={analytics.topCategories}
                  emptyLabel={ta("empty")}
                />
                <RankedBarList
                  title={ta("topVibes")}
                  items={analytics.topVibes}
                  emptyLabel={ta("empty")}
                  colorFor={(i) => CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]}
                />
                <AnalyticsStatTile
                  label={ta("searchesTotal")}
                  value={analytics.searchStats.total}
                  icon={Search}
                  className="bg-coral/15 text-coral-dark dark:text-coral"
                  sub={
                    analytics.searchStats.total > 0
                      ? ta("searchesNoResultsSub", {
                          pct: pct(analytics.searchStats.noResults, analytics.searchStats.total),
                        })
                      : undefined
                  }
                />
              </div>
            </div>

            {/* Audience */}
            <div className="space-y-4">
              <SectionHeading title={ta("audienceSection")} />
              <div className="grid gap-4 lg:grid-cols-3">
                <RankedBarList
                  title={ta("deviceBreakdown")}
                  items={analytics.devices}
                  emptyLabel={ta("empty")}
                  colorFor={(i) => CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]}
                />
                <RankedBarList
                  title={ta("languageSplit")}
                  items={analytics.languages}
                  emptyLabel={ta("empty")}
                  colorFor={(i) => CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]}
                />
                <RankedBarList
                  title={ta("referrers")}
                  items={analytics.referrers.map((r) =>
                    r.label === "direct" ? { ...r, label: ta("direct") } : r,
                  )}
                  emptyLabel={ta("empty")}
                  colorFor={(i) => CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]}
                />
              </div>
            </div>

            {/* Night mode + PWA funnel */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <SectionHeading title={ta("nightModeSection")} />
                <AnalyticsStatTile
                  label={ta("nightModeAdoption")}
                  value={analytics.nightMode.people}
                  icon={Moon}
                  className="bg-magenta/15 text-magenta-dark dark:text-magenta"
                  sub={
                    analytics.summary.uniqueVisitors > 0
                      ? ta("nightModeSub", {
                          pct: pct(analytics.nightMode.people, analytics.summary.uniqueVisitors),
                        })
                      : undefined
                  }
                />
              </div>

              <div className="space-y-4">
                <SectionHeading title={ta("pwaSection")} />
                <div className="grid grid-cols-3 gap-3">
                  <AnalyticsStatTile
                    label={ta("pwaShown")}
                    value={analytics.pwaFunnel.shown}
                    icon={Download}
                    className="bg-aqua/15 text-aqua-dark dark:text-aqua"
                  />
                  <AnalyticsStatTile
                    label={ta("pwaAccepted")}
                    value={analytics.pwaFunnel.accepted}
                    icon={Download}
                    className="bg-lime/15 text-lime-dark dark:text-lime"
                    sub={
                      analytics.pwaFunnel.shown > 0
                        ? ta("pwaConversionSub", {
                            pct: pct(analytics.pwaFunnel.accepted, analytics.pwaFunnel.shown),
                          })
                        : undefined
                    }
                  />
                  <AnalyticsStatTile
                    label={ta("pwaDismissed")}
                    value={analytics.pwaFunnel.dismissed}
                    icon={Download}
                    className="bg-coral/15 text-coral-dark dark:text-coral"
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
