import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

// Root-level file — deliberately outside `[locale]` since robots.txt/sitemap
// aren't localized routes. The proxy's matcher already skips any path with a
// dot, so this doesn't go through locale detection.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Matches /en/admin, /es/admin and everything under them — the
        // admin dashboard has no reason to show up in search results.
        disallow: "/*/admin",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
