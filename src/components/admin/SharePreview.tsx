"use client";

import { useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";

/** The link-preview card (WhatsApp, Facebook…) of a saved spot, one per
 * language. It loads from the app's own og route, i.e. exactly what gets
 * shared — and shows the last *saved* version: the card is regenerated
 * whenever the spot is saved. */
export function SharePreview({ slug, updatedAt }: { slug: string; updatedAt: string }) {
  const t = useTranslations("admin.spotForm.sharePreview");
  const v = Date.parse(updatedAt) || 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {routing.locales.map((locale) => (
        <figure key={locale} className="space-y-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/og/spots/${encodeURIComponent(slug)}?locale=${locale}&v=${v}`}
            alt={`${t("alt")} (${locale.toUpperCase()})`}
            width={1200}
            height={630}
            loading="lazy"
            className="aspect-[1200/630] w-full rounded-xl border border-border bg-foreground/5 object-cover"
          />
          <figcaption className="text-xs font-semibold uppercase text-foreground/50">
            {locale}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
