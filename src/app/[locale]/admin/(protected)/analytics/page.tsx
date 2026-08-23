import { getTranslations } from "next-intl/server";
import {
  Users,
  Eye,
  Search,
  Download,
  TriangleAlert,
  MessageCircle,
  Navigation,
  Ticket,
  MapPin,
  Moon,
} from "lucide-react";
import { RankedBarList } from "@/components/admin/RankedBarList";
import { AnalyticsStatTile } from "@/components/admin/AnalyticsStatTile";
import { PageviewTrendChart } from "@/components/admin/PageviewTrendChart";
import {
  getAnalyticsSummary,
  getDeviceBreakdown,
  getEngagementCounts,
  getLanguageSplit,
  getNightModeStats,
  getPageviewTrend,
  getPwaFunnel,
  getReferrers,
  getSearchStats,
  getTopArticles,
  getTopCategoryFilters,
  getTopEvents,
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

export default async function AdminAnalyticsPage() {
  const t = await getTranslations("admin.analytics");
  const isConfigured = Boolean(
    process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID,
  );

  let data: {
    summary: Awaited<ReturnType<typeof getAnalyticsSummary>>;
    trend: Awaited<ReturnType<typeof getPageviewTrend>>;
    topSpots: Awaited<ReturnType<typeof getTopSpots>>;
    topArticles: Awaited<ReturnType<typeof getTopArticles>>;
    topEvents: Awaited<ReturnType<typeof getTopEvents>>;
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
  let error = false;

  if (isConfigured) {
    try {
      const [
        summary,
        trend,
        topSpots,
        topArticles,
        topEvents,
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
        getPageviewTrend(),
        getTopSpots(),
        getTopArticles(),
        getTopEvents(),
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
      data = {
        summary,
        trend,
        topSpots,
        topArticles,
        topEvents,
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
      error = true;
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-heading text-2xl font-extrabold">{t("title")}</h1>
        <p className="text-sm text-foreground/60">
          {t("subtitle")} · {t("windowLabel")}
        </p>
      </div>

      {!isConfigured && (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-5 text-sm text-foreground/70">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-coral" />
          <p>{t("notConfigured")}</p>
        </div>
      )}

      {isConfigured && error && (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-5 text-sm text-foreground/70">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-coral" />
          <p>{t("error")}</p>
        </div>
      )}

      {data && (
        <>
          {/* Overview */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <AnalyticsStatTile
              label={t("uniqueVisitors")}
              value={data.summary.uniqueVisitors}
              icon={Users}
              className="bg-aqua/15 text-aqua-dark dark:text-aqua"
            />
            <AnalyticsStatTile
              label={t("pageviews")}
              value={data.summary.pageviews}
              icon={Eye}
              className="bg-magenta/15 text-magenta-dark dark:text-magenta"
            />
            <AnalyticsStatTile
              label={t("searches")}
              value={data.summary.searches}
              icon={Search}
              className="bg-coral/15 text-coral-dark dark:text-coral"
            />
            <AnalyticsStatTile
              label={t("pwaInstalls")}
              value={data.summary.pwaInstalls}
              icon={Download}
              className="bg-lime/15 text-lime-dark dark:text-lime"
            />
          </div>

          {/* Traffic trend */}
          <div className="space-y-4">
            <SectionHeading title={t("trafficTrend")} subtitle={t("trafficTrendSubtitle")} />
            <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
              <PageviewTrendChart data={data.trend} emptyLabel={t("empty")} />
            </div>
          </div>

          {/* Most viewed content */}
          <div className="space-y-4">
            <SectionHeading title={t("contentSection")} />
            <div className="grid gap-4 lg:grid-cols-3">
              <RankedBarList title={t("topSpots")} items={data.topSpots} emptyLabel={t("empty")} />
              <RankedBarList
                title={t("topArticles")}
                items={data.topArticles}
                emptyLabel={t("empty")}
              />
              <RankedBarList
                title={t("topEvents")}
                items={data.topEvents}
                emptyLabel={t("empty")}
              />
            </div>
          </div>

          {/* Engagement */}
          <div className="space-y-4">
            <SectionHeading title={t("engagementSection")} subtitle={t("engagementSubtitle")} />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <AnalyticsStatTile
                label={t("whatsappClicks")}
                value={data.engagement.whatsappClicks}
                icon={MessageCircle}
                className="bg-[#25D366]/15 text-[#1a9e4b]"
              />
              <AnalyticsStatTile
                label={t("directionsClicks")}
                value={data.engagement.directionsClicks}
                icon={Navigation}
                className="bg-aqua/15 text-aqua-dark dark:text-aqua"
              />
              <AnalyticsStatTile
                label={t("bookingClicks")}
                value={data.engagement.bookingClicks}
                icon={Ticket}
                className="bg-coral/15 text-coral-dark dark:text-coral"
              />
              <AnalyticsStatTile
                label={t("mapPinClicks")}
                value={data.engagement.mapPinClicks}
                icon={MapPin}
                className="bg-magenta/15 text-magenta-dark dark:text-magenta"
              />
            </div>
          </div>

          {/* Discovery */}
          <div className="space-y-4">
            <SectionHeading title={t("discoverySection")} subtitle={t("discoverySubtitle")} />
            <div className="grid gap-4 lg:grid-cols-3">
              <RankedBarList
                title={t("topCategories")}
                items={data.topCategories}
                emptyLabel={t("empty")}
              />
              <RankedBarList
                title={t("topVibes")}
                items={data.topVibes}
                emptyLabel={t("empty")}
                colorFor={(i) => CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]}
              />
              <AnalyticsStatTile
                label={t("searchesTotal")}
                value={data.searchStats.total}
                icon={Search}
                className="bg-coral/15 text-coral-dark dark:text-coral"
                sub={
                  data.searchStats.total > 0
                    ? t("searchesNoResultsSub", {
                        pct: pct(data.searchStats.noResults, data.searchStats.total),
                      })
                    : undefined
                }
              />
            </div>
          </div>

          {/* Audience */}
          <div className="space-y-4">
            <SectionHeading title={t("audienceSection")} />
            <div className="grid gap-4 lg:grid-cols-3">
              <RankedBarList
                title={t("deviceBreakdown")}
                items={data.devices}
                emptyLabel={t("empty")}
                colorFor={(i) => CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]}
              />
              <RankedBarList
                title={t("languageSplit")}
                items={data.languages}
                emptyLabel={t("empty")}
                colorFor={(i) => CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]}
              />
              <RankedBarList
                title={t("referrers")}
                items={data.referrers.map((r) =>
                  r.label === "direct" ? { ...r, label: t("direct") } : r,
                )}
                emptyLabel={t("empty")}
                colorFor={(i) => CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]}
              />
            </div>
          </div>

          {/* Night mode + PWA funnel */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <SectionHeading title={t("nightModeSection")} />
              <AnalyticsStatTile
                label={t("nightModeAdoption")}
                value={data.nightMode.people}
                icon={Moon}
                className="bg-magenta/15 text-magenta-dark dark:text-magenta"
                sub={
                  data.summary.uniqueVisitors > 0
                    ? t("nightModeSub", {
                        pct: pct(data.nightMode.people, data.summary.uniqueVisitors),
                      })
                    : undefined
                }
              />
            </div>

            <div className="space-y-4">
              <SectionHeading title={t("pwaSection")} />
              <div className="grid grid-cols-3 gap-3">
                <AnalyticsStatTile
                  label={t("pwaShown")}
                  value={data.pwaFunnel.shown}
                  icon={Download}
                  className="bg-aqua/15 text-aqua-dark dark:text-aqua"
                />
                <AnalyticsStatTile
                  label={t("pwaAccepted")}
                  value={data.pwaFunnel.accepted}
                  icon={Download}
                  className="bg-lime/15 text-lime-dark dark:text-lime"
                  sub={
                    data.pwaFunnel.shown > 0
                      ? t("pwaConversionSub", {
                          pct: pct(data.pwaFunnel.accepted, data.pwaFunnel.shown),
                        })
                      : undefined
                  }
                />
                <AnalyticsStatTile
                  label={t("pwaDismissed")}
                  value={data.pwaFunnel.dismissed}
                  icon={Download}
                  className="bg-coral/15 text-coral-dark dark:text-coral"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
