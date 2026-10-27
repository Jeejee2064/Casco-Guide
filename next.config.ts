import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // The share-card route reads its fonts and logo from disk with computed
  // paths, which Next's file tracing can't see — without this they're missing
  // from the deployed (Vercel) function and the image fails.
  outputFileTracingIncludes: {
    "/api/og/**": ["./public/logoletters.png", "./public/hero-tower.svg", "./src/assets/fonts/*"],
  },
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
  // One canonical host: the Vercel domain and the www variant permanently
  // redirect to the apex so they never get indexed as duplicates (and links
  // already shared from them keep working). Opt-in via REDIRECT_TO_CANONICAL
  // so it can only be switched on once the apex domain really serves the
  // site — otherwise the *.vercel.app URL would redirect into the void.
  async redirects() {
    if (process.env.REDIRECT_TO_CANONICAL !== "true") return [];
    const canonical = process.env.NEXT_PUBLIC_SITE_URL ?? "https://cascoviejo.guide";
    return ["casco-guide.vercel.app", "www.cascoviejo.guide"].map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: `${canonical}/:path*`,
      permanent: true,
    }));
  },
  // Heavy static assets that only change when the repo does: let browsers and
  // the CDN keep them for a week (and serve stale while revalidating) instead
  // of Next's default must-revalidate on every visit.
  async headers() {
    const cache = [
      { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
    ];
    return ["/map/:path*", "/foliage/:path*", "/favicon_io/:path*", "/hero.webp", "/hero-tower.svg", "/logo-tower.svg", "/logoletters.png", "/cascoviejo.png"].map(
      (source) => ({ source, headers: cache }),
    );
  },
  skipTrailingSlashRedirect: true,
};

export default withNextIntl(nextConfig);
