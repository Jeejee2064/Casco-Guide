import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
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
};

export default withNextIntl(nextConfig);
