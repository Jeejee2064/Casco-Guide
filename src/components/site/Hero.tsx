"use client";

import { motion } from "framer-motion";
import { ArrowRight, BookOpen, MapIcon, MapPin, Users } from "lucide-react";
// CalendarDays: only used by the events pill below, currently commented out.
import { useTranslations } from "next-intl";
import { HERO_IMAGE } from "@/lib/data/categoryImages";
import { Link } from "@/i18n/navigation";
import { staggerContainer, fadeUp } from "./motion";
import { LoadingImage } from "./LoadingImage";
import { VIBE_META, SPOT_VIBES } from "@/lib/vibes";

/**
 * Full-bleed photo hero — the very first thing anyone sees, on any screen
 * size, and capped at exactly one viewport tall (`h-dvh`) so it never
 * spills into a second scroll before the rest of the homepage shows up. It
 * states what the site is (title + subtitle), puts one direct,
 * always-visible link to each of spots, guides and the map right in front
 * of the visitor (events dropped from this row while hidden site-wide), and
 * closes with a "what's your vibe today?" prompt + one pill per vibe —
 * the fastest path into /spots pre-filtered by mood. The latest guides
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
  const tNav = useTranslations("nav");
  const tDiscover = useTranslations("discover");
  const tVibe = useTranslations("vibe");

  // Four equally-weighted, prominent choices right in the hero (not small
  // pills easy to miss) so a first-time visitor picks one immediately
  // instead of having to scroll to discover what the guide covers. All
  // plain route links now that spots and the map are their own pages —
  // no more client-state toggle needing a separate <button> branch.
  const links = [
    {
      key: "spots",
      href: "/spots" as const,
      icon: MapPin,
      label: tNav("spots"),
    },
    // Events temporarily hidden site-wide — uncomment to restore the card.
    // {
    //   key: "events",
    //   href: { pathname: "/", hash: "events" } as const,
    //   icon: CalendarDays,
    //   label: tNav("events"),
    // },
    {
      key: "articles",
      href: "/articles" as const,
      icon: BookOpen,
      label: tNav("articles"),
    },
    {
      key: "map",
      href: "/map" as const,
      icon: MapIcon,
      label: tDiscover("exploreMap"),
    },
  ];

  const cardClassName =
    "group flex flex-1 items-center justify-between gap-3 rounded-2xl border border-white/25 bg-white/10 px-5 py-4 text-left backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-white/45 hover:bg-white/20";

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

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-10 text-white sm:justify-start sm:px-6 sm:pb-14 sm:pt-16"
      >
        {/* Eyebrow badge — states the "made by locals, not an algorithm"
            trust signal up front, in its own beat before the headline
            (rather than folded into it), so it reads as a credential and
            not just more headline copy. */}
        <motion.span
          variants={fadeUp}
          className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white/90 backdrop-blur-md"
        >
          <Users size={13} className="shrink-0" />
          {t("heroBadge")}
        </motion.span>

        <motion.h1
          variants={fadeUp}
          className="font-heading max-w-2xl text-3xl font-extrabold leading-tight sm:text-5xl"
        >
          {t("title")}
        </motion.h1>

        <motion.p variants={fadeUp} className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
          {t("subtitle")}
        </motion.p>

        <motion.div variants={fadeUp} className="mt-6 flex flex-col gap-3 sm:flex-row">
          {links.map(({ key, href, icon: Icon, label }) => (
            <Link key={key} href={href} className={cardClassName}>
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Icon size={18} />
                </span>
                <span className="text-base font-bold">{label}</span>
              </span>
              <ArrowRight
                size={16}
                className="shrink-0 transition-transform group-hover:translate-x-1"
              />
            </Link>
          ))}
        </motion.div>

        <motion.div variants={fadeUp} className="mt-8 sm:mt-10">
          <h2 className="font-heading text-lg font-bold sm:text-xl">{t("heroVibeTitle")}</h2>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {SPOT_VIBES.map((v) => {
              const meta = VIBE_META[v];
              const Icon = meta.icon;
              return (
                <Link
                  key={v}
                  href={{ pathname: "/spots", query: { vibe: v } }}
                  className="group flex items-center gap-2 rounded-full border py-2 pl-2 pr-4 text-sm font-bold shadow-[0_4px_16px_-6px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all hover:-translate-y-0.5"
                  style={{
                    background: `linear-gradient(135deg, ${meta.color}66, ${meta.color}14)`,
                    borderColor: `${meta.color}59`,
                  }}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-transform duration-200 group-hover:scale-110"
                    style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)` }}
                  >
                    <Icon size={14} strokeWidth={2.25} />
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
