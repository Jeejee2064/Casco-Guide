"use client";

import { LayoutDashboard, MapPin, CalendarDays, LogOut, ExternalLink } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { signOut } from "@/lib/actions/auth";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const locale = useLocale() as Locale;

  const links = [
    { href: "/admin" as const, label: t("dashboard"), icon: LayoutDashboard },
    { href: "/admin/spots" as const, label: t("spots"), icon: MapPin },
    { href: "/admin/events" as const, label: t("events"), icon: CalendarDays },
  ];

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-5 py-5 font-heading text-lg font-extrabold">
        <span className="tropical-gradient flex h-8 w-8 items-center justify-center rounded-full">
          🌴
        </span>
        Casco Admin
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-button)] px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-aqua text-white"
                  : "text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5",
              )}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-border p-3">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-[var(--radius-button)] px-3 py-2.5 text-sm font-semibold text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5"
        >
          <ExternalLink size={17} />
          {t("viewSite")}
        </Link>
        <form action={signOut.bind(null, locale)}>
          <button className="flex w-full items-center gap-3 rounded-[var(--radius-button)] px-3 py-2.5 text-left text-sm font-semibold text-coral hover:bg-coral/10">
            <LogOut size={17} />
            {t("logout")}
          </button>
        </form>
      </div>
    </aside>
  );
}
