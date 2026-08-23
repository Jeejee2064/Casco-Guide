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
    "/spots": "/spots",
    "/spots/[slug]": "/spots/[slug]",
    "/map": "/map",
    "/events/[slug]": "/events/[slug]",
    "/articles": "/articles",
    "/articles/[slug]": "/articles/[slug]",
    "/admin": "/admin",
    "/admin/login": "/admin/login",
    "/admin/preview/spots": "/admin/preview/spots",
    "/admin/preview/events": "/admin/preview/events",
    "/admin/preview/articles": "/admin/preview/articles",
    "/admin/spots": "/admin/spots",
    "/admin/spots/new": "/admin/spots/new",
    "/admin/spots/[id]": "/admin/spots/[id]",
    "/admin/events": "/admin/events",
    "/admin/events/new": "/admin/events/new",
    "/admin/events/[id]": "/admin/events/[id]",
    "/admin/articles": "/admin/articles",
    "/admin/articles/new": "/admin/articles/new",
    "/admin/articles/[id]": "/admin/articles/[id]",
    "/admin/analytics": "/admin/analytics",
  },
});
