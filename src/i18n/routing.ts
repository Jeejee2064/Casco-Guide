import { defineRouting } from "next-intl/routing";

export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "es";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  pathnames: {
    "/": "/",
    "/spots/[slug]": "/spots/[slug]",
    "/events/[slug]": "/events/[slug]",
    "/admin": "/admin",
    "/admin/login": "/admin/login",
    "/admin/preview/spots": "/admin/preview/spots",
    "/admin/preview/events": "/admin/preview/events",
    "/admin/spots": "/admin/spots",
    "/admin/spots/new": "/admin/spots/new",
    "/admin/spots/[id]": "/admin/spots/[id]",
    "/admin/events": "/admin/events",
    "/admin/events/new": "/admin/events/new",
    "/admin/events/[id]": "/admin/events/[id]",
  },
});
