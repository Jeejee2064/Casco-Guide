"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { ArrowRight, BookOpen, MapIcon, MapPin, Users } from "lucide-react";
// CalendarDays: only used by the events pill below, currently commented out.
import { useTranslations } from "next-intl";
import { HERO_IMAGE } from "@/lib/data/categoryImages";
import { Link } from "@/i18n/navigation";
import { staggerContainer, fadeUp } from "./motion";
import { HeroArticles } from "./HeroArticles";
import type { Article } from "@/lib/types/database";

/**
 * Full-bleed photo hero — the very first thing anyone sees, on any screen
 * size. It states what the site is (title + subtitle), puts one direct,
 * always-visible link to each of spots, guides and the map right in front
 * of the visitor (events dropped from this row while hidden site-wide), and
 * — since it no longer needs to fill the whole first viewport on its own —
 * leads straight into the 3 latest guides (see HeroArticles) before the
 * rest of the homepage's content takes over.
 */
export function Hero({
  // eventsCount kept in the props type for call-site compatibility while
  // events are hidden site-wide — unused here since the card below is
  // commented out. spotsCount/articlesCount were dropped entirely (not just
  // unused-and-kept, like eventsCount) — the cards used to show "· 29" style
  // counts, cut in favor of three plain, equally-weighted choices, so
  // page.tsx no longer passes them either.
  eventsCount: _eventsCount,
  articles,
}: {
  eventsCount: number;
  articles: Article[];
}) {
  const t = useTranslations("site");
  const tNav = useTranslations("nav");
  const tDiscover = useTranslations("discover");

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
    <section className="relative isolate overflow-hidden">
      <Image
        src={HERO_IMAGE}
        alt=""
        fill
        preload
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d0a17]/85 via-[#0d0a17]/70 to-[#0d0a17]" />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="relative mx-auto w-full max-w-6xl px-4 pb-10 pt-10 text-white sm:px-6 sm:pb-14 sm:pt-16"
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

        <HeroArticles articles={articles} />
      </motion.div>
    </section>
  );
}
