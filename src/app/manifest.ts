import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/seo/site";

// PWA manifest — lives at the root of `app/` (not under `[locale]`) per the
// file convention, so it's a single locale-agnostic identity for the app.
// Icons are the "Casco Viejo" bell-tower mark (public/cascoviejo.svg)
// pre-rendered to every required raster size in public/favicon_io/.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Casco Viejo",
    description:
      "Guide de Casco Viejo : restaurants, bars, hôtels et incontournables du quartier colonial de Panama City.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf8f4",
    theme_color: "#146b8c",
    icons: [
      {
        src: "/favicon_io/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        src: "/favicon_io/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/favicon_io/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon_io/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon_io/maskable-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
