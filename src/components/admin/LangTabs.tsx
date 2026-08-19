"use client";

import { cn } from "@/lib/utils";

/**
 * Language switcher for the bilingual content fields in the admin
 * forms (name/title, description, article, …). One shared toggle
 * drives every translatable field in a form — see SpotForm/EventForm.
 */
export function LangTabs({
  value,
  onChange,
  incomplete,
}: {
  value: "es" | "en";
  onChange: (lang: "es" | "en") => void;
  incomplete?: { es: boolean; en: boolean };
}) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold">
      {(["es", "en"] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => onChange(lang)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors",
            value === lang
              ? "bg-aqua text-white"
              : "text-foreground/60 hover:bg-black/5 dark:hover:bg-white/10",
          )}
        >
          {lang.toUpperCase()}
          {incomplete?.[lang] && (
            <span
              className={cn("h-1.5 w-1.5 rounded-full", value === lang ? "bg-white" : "bg-coral")}
              aria-hidden
            />
          )}
        </button>
      ))}
    </div>
  );
}
