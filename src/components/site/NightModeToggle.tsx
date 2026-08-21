"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useNightMode } from "./NightModeContext";
import { cn } from "@/lib/utils";

/**
 * Sun/moon switch that flips the whole site into Night Mode (see
 * NightModeContext + the `.night` rules in globals.css). Deliberately its
 * own control rather than folded into the Classic/Vibes segmented control
 * next to it — this toggles a site-wide theme, not a filter.
 */
export function NightModeToggle() {
  const t = useTranslations("night");
  const { isNight, toggleNight } = useNightMode();

  return (
    <button
      type="button"
      onClick={toggleNight}
      aria-pressed={isNight}
      aria-label={t("toggle")}
      title={t("toggle")}
      className={cn(
        "glass pill-lift inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
        isNight
          ? "border-[#3a2d66] text-[#ffcf6b]"
          : "border-border text-foreground/70 hover:text-foreground",
      )}
    >
      <span className="hidden whitespace-nowrap uppercase tracking-wide sm:inline">
        {isNight ? t("nightMode") : t("dayMode")}
      </span>

      <span
        className={cn(
          "relative flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300",
          isNight ? "bg-[#241a44]" : "bg-amber-100",
        )}
      >
        <Sun
          size={12}
          className={cn(
            "absolute left-1.5 text-amber-500 transition-opacity duration-300",
            isNight ? "opacity-0" : "opacity-100",
          )}
        />
        <Moon
          size={11}
          fill="currentColor"
          className={cn(
            "absolute right-1.5 text-[#8b7bd8] transition-opacity duration-300",
            isNight ? "opacity-100" : "opacity-0",
          )}
        />
        <span
          className={cn(
            "z-10 flex h-5 w-5 items-center justify-center rounded-full shadow-sm transition-transform duration-300",
            isNight ? "translate-x-[22px] bg-[#3a2d66] text-[#ffcf6b]" : "translate-x-0.5 bg-white text-amber-500",
          )}
        >
          {isNight ? <Moon size={11} fill="currentColor" /> : <Sun size={11} />}
        </span>
      </span>
    </button>
  );
}
