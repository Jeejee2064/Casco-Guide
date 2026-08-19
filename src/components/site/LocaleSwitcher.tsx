"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useParams } from "next/navigation";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  return (
    <div className="flex items-center rounded-full border border-border bg-surface p-0.5 text-xs font-bold">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          onClick={() =>
            router.replace(
              // @ts-expect-error -- pathname/params are dynamic across routes
              { pathname, params },
              { locale: loc },
            )
          }
          className={`rounded-full px-2.5 py-1.5 uppercase transition-colors ${
            loc === locale ? "bg-aqua text-white" : "text-foreground/60 hover:text-foreground"
          }`}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
