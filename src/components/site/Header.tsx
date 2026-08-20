"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { EASE_OUT } from "./motion";
import { useExploreView } from "./ExploreViewContext";

export function Header() {
  const t = useTranslations("site");
  const tNav = useTranslations("nav");
  const tMap = useTranslations("map");

  // The full map takes over the header's usual grid-navigation role — the
  // spots/events choice happens on the map itself now — so this collapses to
  // branding plus a way back to the list instead of duplicating that switch.
  const { isMapView, setIsMapView } = useExploreView();

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="glass safe-top sticky top-0 z-30 border-b border-border"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {isMapView && (
            <button
              type="button"
              onClick={() => setIsMapView(false)}
              aria-label={tMap("backToList")}
              title={tMap("backToList")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <Link
            href="/"
            // Same destination as the back button when already on the map —
            // handle it the same instant way instead of a real navigation.
            onClick={(e) => {
              if (isMapView) {
                e.preventDefault();
                setIsMapView(false);
              }
            }}
            className="flex shrink-0 items-center gap-2.5 font-heading text-lg font-extrabold tracking-tight"
          >
            <span className="brand-accent flex h-9 w-9 items-center justify-center rounded-2xl text-white shadow-md">
              <Compass size={18} strokeWidth={2.25} />
            </span>
            <span className="hidden sm:inline">{t("name")}</span>
          </Link>
        </div>

        {!isMapView && (
          <nav className="flex items-center gap-1 text-sm font-semibold text-foreground/60">
            <Link
              href={{ pathname: "/", hash: "explore" }}
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
            >
              {tNav("spots")}
            </Link>
            <Link
              href={{ pathname: "/", hash: "events" }}
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
            >
              {tNav("events")}
            </Link>
            <Link
              href="/articles"
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
            >
              {tNav("articles")}
            </Link>
          </nav>
        )}

        <LocaleSwitcher />
      </div>
    </motion.header>
  );
}
