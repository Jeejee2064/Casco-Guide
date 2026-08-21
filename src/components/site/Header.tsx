"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
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
      // Solid, not `.glass`: this bar sits directly over the scrolling grid
      // and backdrop-filter support/compositing is inconsistent enough
      // (disabled GPU, some mobile browsers) that the fallback — a merely
      // translucent bar with no blur — let card content show through
      // fully legible. `.bar-surface` is solid too, just with a whisper of
      // gradient so it doesn't read as a flat cutout (see globals.css).
      className="bar-surface safe-top sticky top-0 z-30 border-b border-border shadow-[var(--shadow-sm)]"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {isMapView && (
            <button
              type="button"
              onClick={() => setIsMapView(false)}
              aria-label={tMap("backToList")}
              title={tMap("backToList")}
              className="pill-lift flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/70 hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
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
            className="group flex shrink-0 items-center gap-2.5 font-heading text-lg font-extrabold tracking-tight"
          >
            <span className="relative flex h-9 w-9 shrink-0 overflow-hidden rounded-2xl shadow-md transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110">
              <Image src="/cascoviejo.png" alt="" fill sizes="36px" className="object-cover" />
            </span>
            <span className="hidden sm:inline">{t("name")}</span>
          </Link>
        </div>

        {!isMapView && (
          <nav className="flex items-center gap-1 text-sm font-semibold text-foreground/60">
            <Link
              href={{ pathname: "/", hash: "explore" }}
              className="pill-lift rounded-full px-3 py-1.5 hover:bg-gradient-to-r hover:from-aqua/10 hover:to-coral/10 hover:text-foreground"
            >
              {tNav("spots")}
            </Link>
            {/* Events temporarily hidden site-wide — see AGENTS note in this
                PR/commit. Uncomment to bring the nav link back. */}
            {/* <Link
              href={{ pathname: "/", hash: "events" }}
              className="pill-lift rounded-full px-3 py-1.5 hover:bg-gradient-to-r hover:from-aqua/10 hover:to-coral/10 hover:text-foreground"
            >
              {tNav("events")}
            </Link> */}
            <Link
              href="/articles"
              className="pill-lift rounded-full px-3 py-1.5 hover:bg-gradient-to-r hover:from-aqua/10 hover:to-coral/10 hover:text-foreground"
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
