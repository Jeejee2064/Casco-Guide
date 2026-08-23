import { getLocale, getTranslations } from "next-intl/server";
import { MessageCircle, Navigation, MapPin, Share2, TriangleAlert } from "lucide-react";
import { getSpots } from "@/lib/data/spots";
import type { Locale } from "@/i18n/routing";
import { AnalyticsStatTile } from "@/components/admin/AnalyticsStatTile";
import { SpotInteractionsTable, type SpotInteractionRow } from "@/components/admin/SpotInteractionsTable";
import { getEngagementCounts, getSpotInteractionCounts } from "@/lib/analytics/posthog-server";

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="font-heading text-lg font-extrabold">{title}</h2>
      {subtitle && <p className="text-sm text-foreground/50">{subtitle}</p>}
    </div>
  );
}

/** Split out of the main dashboard — the interactions table especially got
 * long enough (every spot, sortable, filterable) that it was crowding out
 * everything else on the Panel page. Same PostHog-backed data, own tab. */
export default async function AdminEngagementPage() {
  const ta = await getTranslations("admin.analytics");
  const locale = (await getLocale()) as Locale;
  const spots = await getSpots(locale);

  const isConfigured = Boolean(
    process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID,
  );

  let data: {
    engagement: Awaited<ReturnType<typeof getEngagementCounts>>;
    spotInteractions: Awaited<ReturnType<typeof getSpotInteractionCounts>>;
  } | null = null;
  let error = false;

  if (isConfigured) {
    try {
      const [engagement, spotInteractions] = await Promise.all([
        getEngagementCounts(),
        getSpotInteractionCounts(),
      ]);
      data = { engagement, spotInteractions };
    } catch {
      error = true;
    }
  }

  // Every spot, PostHog's per-slug counts merged onto Supabase's spot list
  // (not the other way around) so a spot with zero interactions still gets
  // a row — the whole point of a ranking meant to tell a business
  // "you're #37", not just list who happened to show up in PostHog.
  const spotInteractionRows: SpotInteractionRow[] = data
    ? spots
        .map((spot) => {
          const c = data.spotInteractions[spot.slug] ?? {
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
      <div>
        <h1 className="font-heading text-2xl font-extrabold">{ta("engagementSection")}</h1>
        <p className="text-sm text-foreground/60">
          {ta("engagementSubtitle")} · {ta("windowLabel")}
        </p>
      </div>

      {!isConfigured && (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-5 text-sm text-foreground/70">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-coral" />
          <p>{ta("notConfigured")}</p>
        </div>
      )}

      {isConfigured && error && (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-5 text-sm text-foreground/70">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-coral" />
          <p>{ta("error")}</p>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <AnalyticsStatTile
              label={ta("whatsappClicks")}
              value={data.engagement.whatsappClicks}
              icon={MessageCircle}
              className="bg-[#25D366]/15 text-[#1a9e4b]"
            />
            <AnalyticsStatTile
              label={ta("directionsClicks")}
              value={data.engagement.directionsClicks}
              icon={Navigation}
              className="bg-aqua/15 text-aqua-dark dark:text-aqua"
            />
            <AnalyticsStatTile
              label={ta("mapPinClicks")}
              value={data.engagement.mapPinClicks}
              icon={MapPin}
              className="bg-magenta/15 text-magenta-dark dark:text-magenta"
            />
            <AnalyticsStatTile
              label={ta("shareClicks")}
              value={data.engagement.shareClicks}
              icon={Share2}
              className="bg-coral/15 text-coral-dark dark:text-coral"
            />
          </div>

          <div className="space-y-4">
            <SectionHeading
              title={ta("interactionsSection")}
              subtitle={ta("interactionsSubtitle")}
            />
            <SpotInteractionsTable rows={spotInteractionRows} />
          </div>
        </>
      )}
    </div>
  );
}
