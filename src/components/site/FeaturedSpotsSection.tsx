"use client";

import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { SpotCard } from "./SpotCard";
import { Stagger, StaggerItem } from "./motion";
import type { Spot } from "@/lib/types/database";

/**
 * Homepage teaser into /spots — a handful of top-rated spots (see
 * page.tsx's slice), same SpotCard + `router.push` pattern NearbySection
 * uses on spot/event detail pages, plus a count-aware "Explore all N spots"
 * link into the full grid.
 */
export function FeaturedSpotsSection({ spots, totalCount }: { spots: Spot[]; totalCount: number }) {
  const t = useTranslations("home.featuredSpots");
  const router = useRouter();

  if (spots.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-extrabold sm:text-3xl">{t("title")}</h2>
          <p className="mt-1 text-foreground/60">{t("subtitle")}</p>
        </div>
        <Link
          href="/spots"
          className="group flex shrink-0 items-center gap-1.5 text-sm font-semibold text-aqua hover:underline"
        >
          {t("cta", { count: totalCount })}
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      <Stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" amount={0.05}>
        {spots.map((spot) => (
          <StaggerItem key={spot.id}>
            <SpotCard
              spot={spot}
              onClick={() =>
                router.push({ pathname: "/spots/[slug]", params: { slug: spot.slug } })
              }
            />
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
