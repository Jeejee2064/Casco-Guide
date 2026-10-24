"use client";

import { motion } from "framer-motion";
import { ArrowRight, MapPinned, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { HERO_IMAGE } from "@/lib/data/categoryImages";
import { Link } from "@/i18n/navigation";
import { staggerContainer, fadeUp } from "./motion";
import { LoadingImage } from "./LoadingImage";
import { VIBE_META, SPOT_VIBES } from "@/lib/vibes";

// Hero-only display order (SPOT_VIBES keeps its own order for the rest of the
// app): foodie, arts, work first, rooftops last.
const HERO_VIBE_ORDER: typeof SPOT_VIBES = [
  "gastro_trendy",
  "arts_culture",
  "nomad_work",
  "romantic_sunset",
  "shopping_boutiques",
  "rooftop_party",
];

/**
 * Full-bleed photo hero. Left-aligned pitch (headline, one-line promise, two
 * doors: all spots / map) with the six big vibe cards below (all visible at
 * once, one tap into /spots pre-filtered by mood). On desktop it fills the
 * first screen with the content pinned to the bottom; on mobile it just
 * wraps its content (no min height), so there's no empty photo above the
 * text.
 */
export function Hero({ spotsCount }: { spotsCount: number }) {
  const t = useTranslations("site");
  const tFeatured = useTranslations("home.featuredSpots");
  const tDiscover = useTranslations("discover");
  const tVibe = useTranslations("vibe");

  return (
    <section className="relative isolate flex sm:min-h-[calc(100svh-5.75rem)] flex-col overflow-hidden">
      <LoadingImage src={HERO_IMAGE} alt="" preload sizes="100vw" className="object-cover" />
      {/* Darker on the left where the text sits, opening up to the photo on
          the right; bottom fade keeps the vibe row legible. */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0d0a17]/90 via-[#0d0a17]/55 to-[#0d0a17]/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d0a17] via-transparent to-[#0d0a17]/40" />

      {/* Giant tower mark (white, no tile) as a ghosted backdrop, dead center
          of the hero. Plain <img>: decorative SVG, no optimization needed. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero-tower.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[55%] max-h-[28rem] w-auto -translate-x-1/2 -translate-y-1/2 select-none opacity-15"
      />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-end px-4 pb-6 pt-10 text-white sm:pt-16 sm:px-6 sm:pb-10"
      >
        <div className="mb-6 sm:mb-8">
          <motion.p
            variants={fadeUp}
            className="mb-5 flex items-center gap-2 text-sm font-semibold text-[#bfe6f2]"
          >
            <Users size={16} className="shrink-0 text-[#4fb3d9]" />
            {t("heroBadge")}
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="max-w-4xl text-balance text-[2.75rem] font-normal leading-[1.02] tracking-tight sm:text-7xl lg:text-[5.5rem]"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            {t("title")}
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-5 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg"
          >
            {t("subtitle")}
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/spots"
              className="group inline-flex items-center gap-2 rounded-full bg-[#4fb3d9] px-6 py-3 text-sm font-bold text-[#0d0a17] shadow-[0_8px_24px_-8px_rgba(79,179,217,0.7)] transition-colors hover:bg-[#7cc8e5] sm:text-base"
            >
              {tFeatured("cta", { count: spotsCount })}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/map"
              className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-md transition-colors hover:bg-white/20 sm:text-base"
            >
              <MapPinned size={16} />
              {tDiscover("exploreMap")}
            </Link>
          </motion.div>
        </div>

        <motion.div variants={fadeUp}>
          <h2 className="font-heading text-2xl font-extrabold sm:text-3xl">{t("heroVibeTitle")}</h2>
          <div className="mt-4 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))] sm:gap-4">
            {HERO_VIBE_ORDER.map((v) => {
              const meta = VIBE_META[v];
              const Icon = meta.icon;
              return (
                <Link
                  key={v}
                  href={{ pathname: "/spots", query: { vibe: v } }}
                  className="group flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-base font-bold shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all hover:-translate-y-1 sm:p-4 sm:text-lg"
                  style={{
                    background: `linear-gradient(135deg, ${meta.color}66, ${meta.color}14)`,
                    borderColor: `${meta.color}59`,
                  }}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-transform duration-200 group-hover:scale-110 sm:h-12 sm:w-12"
                    style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)` }}
                  >
                    <Icon size={20} strokeWidth={2.25} />
                  </span>
                  {tVibe(v)}
                </Link>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
