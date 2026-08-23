"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { NightModeToggle } from "./NightModeToggle";
import { EASE_OUT } from "./motion";

export function Header() {
  const t = useTranslations("site");
  const tNav = useTranslations("nav");

  // Night mode + locale live inline from `sm` up; below that they'd crowd
  // the bar next to branding/nav, so they move into this burger instead.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      //
      // z-[45], not z-30: `sticky` + z-index makes this its own stacking
      // context, which traps the mobile burger dropdown's z-50 inside it —
      // that inner value only wins against siblings *inside* this header,
      // it can't out-rank a sibling stacking context outside it. Right
      // below this header, ExploreFilterBar is `sticky`/`fixed` at z-40, so
      // at z-30 the header (dropdown included) used to render *behind* it
      // — the burger menu was opening invisible under the filter bar. 45
      // clears that (and SpotMap's fullscreen `z-10`) while staying below
      // the z-50 full-page modals (SpotDetailModal etc.), which still need
      // to cover the header when they're open.
      className="bar-surface safe-top sticky top-0 z-[45] border-b border-border shadow-[var(--shadow-sm)]"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/"
            onClick={() => {
              // Going from e.g. "/#explore" back to "/" is a same-path
              // navigation, which Next.js doesn't treat as a "new page" for
              // scroll-restoration purposes — it leaves the scroll position
              // where it was instead of resetting it. Force it here so the
              // logo always lands back at the very top.
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="group flex shrink-0 items-center gap-2.5 font-heading text-lg font-extrabold tracking-tight"
          >
            <span className="brand-accent relative flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl shadow-md transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110">
              <Image src="/cascoviejo.png" alt="" width={28} height={28} className="object-contain" />
            </span>
            {/* Wordmark image, not the plain t("name") string — matches the
                logotype used elsewhere (og-image, splash). Ships as a white
                mark on transparent (made for a dark surface); `.header-
                logotype` (globals.css) inverts it to black for the default
                light header and undoes that for OS dark / Night Mode, both
                of which already run a dark header where white is correct
                as-is. Sized well past the icon's own height (rather than
                matched to it) — a wordmark this wide reads cramped/small at
                a strictly icon-matched height, needs the extra size to
                actually read as a logo, not a caption. */}
            <Image
              src="/logoletters.png"
              alt={t("name")}
              width={250}
              height={50}
              className="header-logotype hidden object-contain sm:block"
            />
          </Link>
        </div>

        <nav className="flex items-center gap-1 text-sm font-semibold text-foreground/60">
          <Link
            href="/spots"
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
          <Link
            href="/map"
            className="pill-lift rounded-full px-3 py-1.5 hover:bg-gradient-to-r hover:from-aqua/10 hover:to-coral/10 hover:text-foreground"
          >
            {tNav("map")}
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <NightModeToggle />
            <LocaleSwitcher />
          </div>

          {/* Mobile-only burger — same two controls, just tucked away so
              they don't fight the nav links for space below `sm`. */}
          <div className="relative sm:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={t("menu")}
              aria-expanded={mobileMenuOpen}
              className="pill-lift flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <AnimatePresence>
              {mobileMenuOpen && (
                <>
                  {/* Transparent click-outside-to-close catcher — same idiom
                      as VibesModal's backdrop, just invisible here since
                      this menu doesn't need to dim the page behind it. */}
                  <motion.div
                    onClick={() => setMobileMenuOpen(false)}
                    className="fixed inset-0 z-40"
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.18, ease: EASE_OUT }}
                    className="glass absolute right-0 top-full z-50 mt-2 flex flex-col items-stretch gap-2 rounded-2xl border border-border p-3 shadow-lg"
                  >
                    <NightModeToggle />
                    <LocaleSwitcher />
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
