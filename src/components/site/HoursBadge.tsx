"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { getHoursStatus, formatTime } from "@/lib/hours";
import type { Spot } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export function HoursBadge({ spot, className }: { spot: Spot; className?: string }) {
  const t = useTranslations("hours");
  const locale = useLocale();
  const status = getHoursStatus(spot);

  // `-readable` variants (globals.css) blend each brand color toward
  // `--foreground` instead of swapping on Tailwind's `dark:` variant —
  // that variant only fires on OS `prefers-color-scheme: dark`, never on
  // the separately-toggled Night Mode (`[data-night]`), which used to
  // leave this badge unreadably dark-on-dark there. `bg-foreground/*` for
  // "closed" is the same fix applied to what used to be a
  // `bg-black/5 dark:bg-white/10` swap.
  const styles: Record<string, string> = {
    open: "bg-lime/15 text-lime-readable",
    "closing-soon": "bg-coral/15 text-coral-readable",
    "opens-later": "bg-aqua/15 text-aqua-readable",
    closed: "bg-foreground/5 text-foreground/45",
  };

  const dot: Record<string, string> = {
    open: "bg-lime",
    "closing-soon": "bg-coral",
    "opens-later": "bg-aqua",
    closed: "bg-gray-400",
  };

  let label: string;
  switch (status.state) {
    case "open":
      label = t("openTill", { time: formatTime(status.closesAt, locale) });
      break;
    case "closing-soon":
      label = t("closingSoon", { time: formatTime(status.closesAt, locale) });
      break;
    case "opens-later":
      label = t("opensAt", { time: formatTime(status.opensAt, locale) });
      break;
    default:
      label = t("closed");
  }

  return (
    <Badge className={cn(styles[status.state], className)}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          dot[status.state],
          // Only "open" breathes — a live/time-based cue, not decoration
          // (see .status-dot--live in globals.css).
          status.state === "open" && "status-dot--live",
        )}
      />
      {label}
    </Badge>
  );
}
