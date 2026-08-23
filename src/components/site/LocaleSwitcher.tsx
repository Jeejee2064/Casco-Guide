"use client";

import { motion } from "framer-motion";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useParams } from "next/navigation";
import { TAP_SPRING } from "./motion";
import { track } from "@/lib/analytics/track";

/**
 * EN/ES switch — same sliding-pill idiom as the Classic/Vibes and grid/map
 * segmented controls (shared `layoutId` pattern, just its own id) rather
 * than a flat active-state fill, so the three segmented controls in the UI
 * read as one consistent motif instead of one being visually different.
 */
export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  return (
    <div className="relative flex items-center rounded-full border border-border bg-surface p-0.5 text-xs font-bold">
      {routing.locales.map((loc) => {
        const active = loc === locale;
        return (
          <motion.button
            key={loc}
            type="button"
            onClick={() => {
              track("language_switch", { to: loc });
              router.replace(
                // @ts-expect-error -- pathname/params are dynamic across routes
                { pathname, params },
                { locale: loc },
              );
            }}
            aria-pressed={active}
            whileTap={{ scale: 0.92 }}
            transition={TAP_SPRING}
            className={`relative z-10 rounded-full px-2.5 py-1.5 uppercase transition-colors ${
              active ? "text-white" : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {active && (
              <motion.span
                layoutId="locale-pill"
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
                className="brand-accent absolute inset-0 -z-10 rounded-full"
              />
            )}
            {loc}
          </motion.button>
        );
      })}
    </div>
  );
}
