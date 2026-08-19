"use client";

import { Monitor, LayoutGrid, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type PreviewMode = "desktop" | "card" | "mobile";

const MODES: { mode: PreviewMode; icon: typeof Monitor; labelKey: string }[] = [
  { mode: "desktop", icon: Monitor, labelKey: "viewDesktop" },
  { mode: "card", icon: LayoutGrid, labelKey: "viewCard" },
  { mode: "mobile", icon: Smartphone, labelKey: "viewMobile" },
];

/** Switches the admin preview overlay between the full desktop detail page,
 * the listing-card look, and a real-viewport mobile simulation. */
export function PreviewModeTabs({
  value,
  onChange,
}: {
  value: PreviewMode;
  onChange: (mode: PreviewMode) => void;
}) {
  const t = useTranslations("admin.preview");

  return (
    <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
      {MODES.map(({ mode, icon: Icon, labelKey }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors",
            value === mode
              ? "bg-aqua text-white"
              : "text-foreground/60 hover:bg-black/5 dark:hover:bg-white/10",
          )}
        >
          <Icon size={14} />
          <span className="hidden sm:inline">{t(labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
