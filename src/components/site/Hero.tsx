"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
// CalendarDays: only used by the events pill below, currently commented out.
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
 * Full-bleed photo hero — the very first thing anyone sees, on any screen
 * size, and capped at exactly one viewport tall (`h-dvh`) so it never
 * spills into a second scroll before the rest of the homepage shows up. It
 * states what the site is (title + subtitle) and then leads with a
 * "what's your vibe today?" prompt + one large card per vibe — the fastest
 * path into /spots pre-filtered by mood. (The spots/guides/map buttons were
 * dropped: they duplicated the navbar.) The latest guides
 * showcase that used to live here moved out to its own section further
 * down the homepage (see LatestGuidesSection).
 */
export function Hero({
  // eventsCount kept in the props type for call-site compatibility while
  // events are hidden site-wide — unused here since the card below is
  // commented out. spotsCount/articlesCount were dropped entirely (not just
  // unused-and-kept, like eventsCount) — the cards used to show "· 29" style
  // counts, cut in favor of three plain, equally-weighted choices, so
  // page.tsx no longer passes them either.
  eventsCount: _eventsCount,
}: {
  eventsCount: number;
}) {
  const t = useTranslations("site");
  const tVibe = useTranslations("vibe");

  // Accent the neighborhood name (always the tail of the title) in italic
  // blue so the headline isn't one flat white block.
  const title = t("title");
  const accentAt = title.indexOf("Casco Viejo");
  const titleHead = accentAt === -1 ? title : title.slice(0, accentAt);
  const vibeParts = t("heroVibeTitle").split("vibe");
  const titleAccent = accentAt === -1 ? "" : title.slice(accentAt);

  return (
    <section className="relative isolate flex h-dvh flex-col overflow-hidden">
      <LoadingImage
        src={HERO_IMAGE}
        alt=""
        preload
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d0a17]/85 via-[#0d0a17]/70 to-[#0d0a17]" />

      {/* Giant tower mark (white, no tile) as a ghosted backdrop, dead
          center of the hero. Plain <img>: decorative SVG, no optimization
          needed. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero-tower.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[55%] max-h-[28rem] w-auto -translate-x-1/2 -translate-y-1/2 select-none opacity-15"
      />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 text-white sm:px-6 sm:py-10"
      >
        {/* Top half: pitch, vertically centered in its half. */}
        <div className="flex flex-1 basis-0 flex-col justify-center">
          {/* Eyebrow badge — states the "made by locals, not an algorithm"
            trust signal up front, in its own beat before the headline
            (rather than folded into it), so it reads as a credential and
            not just more headline copy. */}
          <motion.span
            variants={fadeUp}
            className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-[#4fb3d9]/40 bg-[#146b8c]/30 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#bfe6f2] backdrop-blur-md"
          >
            <Users size={13} className="shrink-0 text-[#4fb3d9]" />
            {t("heroBadge")}
          </motion.span>

          <motion.h1
            variants={fadeUp}
            className="font-display max-w-3xl text-5xl font-normal leading-[1.02] tracking-tight sm:text-7xl"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            {titleHead}
            {titleAccent && (
              <em className="pr-1 italic text-[#4fb3d9]">{titleAccent}</em>
            )}
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-4 max-w-xl text-sm leading-relaxed text-white/75 sm:text-lg"
          >
            {t("subtitle")}
          </motion.p>
        </div>

        {/* Bottom half: vibes, starting right under the midline. */}
        <div className="flex flex-1 basis-0 flex-col justify-start">
          <motion.div variants={fadeUp} className="mt-2 sm:mt-4">
            <h2 className="font-heading text-2xl font-extrabold sm:text-3xl">
              {vibeParts[0]}
              {vibeParts.length > 1 && (
                <em
                  className="px-1 text-[1.6em] font-normal not-italic leading-none tracking-[0.12em] text-white"
                  style={{
                    fontFamily: "Technova, var(--font-heading), sans-serif",
                  }}
                >
                  Vibe
                </em>
              )}
              {vibeParts[1]}
            </h2>
            <div className="mt-5 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))] sm:gap-4">
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
                      style={{
                        background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)`,
                      }}
                    >
                      <Icon size={20} strokeWidth={2.25} />
                    </span>
                    {tVibe(v)}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
