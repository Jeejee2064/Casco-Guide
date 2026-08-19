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

  const styles: Record<string, string> = {
    open: "bg-lime/15 text-lime-dark dark:text-lime",
    "closing-soon": "bg-coral/15 text-coral-dark dark:text-coral",
    "opens-later": "bg-aqua/15 text-aqua-dark dark:text-aqua",
    closed: "bg-black/5 text-gray-500 dark:bg-white/10 dark:text-gray-400",
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
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[status.state])} />
      {label}
    </Badge>
  );
}
