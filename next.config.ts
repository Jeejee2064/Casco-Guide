import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    // AVIF first: ~20% smaller than WebP for browsers that support it
    // (nearly all current ones), WebP as the fallback for the rest — Next
    // caches both per source image, negligible extra disk cost at this
    // site's image volume for a real payload win on every spot/article photo.
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // Server Actions default to a 1MB request body — too small for the spot
    // import tool, which can send up to 5 screenshots (5MB each, enforced in
    // lib/actions/importSpot.ts) in a single call. 30mb covers that worst
    // case plus multipart overhead.
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
  async rewrites() {
    const posthogHost = process.env.POSTHOG_HOST;
    const posthogAssetsHost = process.env.POSTHOG_ASSETS_HOST;

    if (!posthogHost || !posthogAssetsHost) return { beforeFiles: [] };

    // `beforeFiles`, not a plain array — a plain array's rewrites are
    // checked *after* Next's own routing/redirects, and next-intl's locale
    // prefixing (see src/i18n/routing.ts's localePrefix: "always") was
    // redirecting /ingest/* to /es/ingest/* before this rewrite ever got a
    // chance to run, silently sending every PostHog request into a 404 and
    // dropping 100% of events. `beforeFiles` runs ahead of that redirect.
    return {
      beforeFiles: [
        {
          source: "/ingest/static/:path*",
          destination: `${posthogAssetsHost}/static/:path*`,
        },
        {
          source: "/ingest/array/:path*",
          destination: `${posthogAssetsHost}/array/:path*`,
        },
        {
          source: "/ingest/:path*",
          destination: `${posthogHost}/:path*`,
        },
      ],
    };
  },
  skipTrailingSlashRedirect: true,
};

export default withNextIntl(nextConfig);
