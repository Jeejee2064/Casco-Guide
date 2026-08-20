"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { ArrowRight, BookOpen, CalendarDays, MapIcon, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { HERO_IMAGE } from "@/lib/data/categoryImages";
import { Link } from "@/i18n/navigation";
import { useExploreView } from "./ExploreViewContext";
import { staggerContainer, fadeUp } from "./motion";

/**
 * Full-bleed photo hero — the very first thing anyone sees, on any screen
 * size. It states what the site is (title + subtitle) and, more
 * importantly, puts one direct, always-visible link to each of the three
 * content types (spots, events, guides) right in front of the visitor, so
 * nobody has to scroll to discover the guide covers more than just a map of
 * places to eat.
 */
export function Hero({
  spotsCount,
  eventsCount,
  articlesCount,
}: {
  spotsCount: number;
  eventsCount: number;
  articlesCount: number;
}) {
  const t = useTranslations("site");
  const tNav = useTranslations("nav");
  const tDiscover = useTranslations("discover");
  // Same instant, no-round-trip toggle the floating grid/map switcher uses
  // (see ExploreSection) — this page is dynamic, so routing the map pill's
  // click through `?view=map` would cost a full server render for something
  // that should feel like flipping a tab.
  const { setIsMapView } = useExploreView();

  const links = [
    {
      key: "spots",
      href: { pathname: "/", hash: "explore" } as const,
      icon: MapPin,
      label: tNav("spots"),
      count: spotsCount,
    },
    {
      key: "events",
      href: { pathname: "/", hash: "events" } as const,
      icon: CalendarDays,
      label: tNav("events"),
      count: eventsCount,
    },
    {
      key: "articles",
      href: "/articles" as const,
      icon: BookOpen,
      label: tNav("articles"),
      count: articlesCount,
    },
  ];

  const pillClassName =
    "group flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold backdrop-blur-md transition-colors hover:border-white/40 hover:bg-white/20";

  return (
    <section className="relative isolate flex min-h-[68svh] items-end overflow-hidden sm:min-h-[70svh]">
      <Image
        src={HERO_IMAGE}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0d0a17] via-[#0d0a17]/55 to-[#0d0a17]/10" />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="relative mx-auto w-full max-w-6xl px-4 pb-8 pt-10 text-white sm:px-6 sm:pb-12 sm:pt-16"
      >
        <motion.span
          variants={fadeUp}
          className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-white/70"
        >
          <MapPin size={13} className="text-gold" />
          Casco Viejo, Panama City
        </motion.span>

        <motion.h1
          variants={fadeUp}
          className="font-heading mt-2 max-w-2xl text-3xl font-extrabold leading-tight sm:text-5xl"
        >
          <span className="gradient-text">{t("title")}</span>
        </motion.h1>

        <motion.p variants={fadeUp} className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
          {t("subtitle")}
        </motion.p>

        <motion.div variants={fadeUp} className="mt-6 flex flex-wrap gap-2 sm:gap-3">
          {links.map(({ key, href, icon: Icon, label, count }) => (
            <Link key={key} href={href} className={pillClassName}>
              <Icon size={16} className="shrink-0" />
              {label}
              <span className="text-white/55">· {count}</span>
              <ArrowRight
                size={14}
                className="shrink-0 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          ))}

          <button type="button" onClick={() => setIsMapView(true)} className={pillClassName}>
            <MapIcon size={16} className="shrink-0" />
            {tDiscover("exploreMap")}
            <ArrowRight
              size={14}
              className="shrink-0 transition-transform group-hover:translate-x-0.5"
            />
          </button>
        </motion.div>
      </motion.div>
    </section>
  );
}
