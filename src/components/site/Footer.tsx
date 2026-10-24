import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Foliage } from "./Foliage";

const LINKS = [
  { href: "/spots", key: "spots" },
  { href: "/articles", key: "articles" },
  { href: "/map", key: "map" },
] as const;

/**
 * Brand footer — the tower tile and wordmark (same assets as the Header; the
 * wordmark ships white, `.header-logotype` inverts it on light themes), the
 * tagline, and the three main sections.
 */
export function Footer() {
  const t = useTranslations("site");
  const tNav = useTranslations("nav");
  return (
    <footer className="safe-bottom relative isolate mt-auto overflow-hidden border-t border-border px-4 py-10 text-center sm:py-14">
      <Foliage name="palme" className="-left-10 -top-10 h-40 w-40 -rotate-12 text-[var(--foliage-green)]" />

      <Link href="/" className="group mx-auto inline-flex flex-col items-center gap-3" aria-label={t("name")}>
        <span className="brand-accent flex h-14 w-14 items-center justify-center rounded-2xl shadow-md transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110">
          <Image src="/cascoviejo.png" alt="" width={36} height={36} className="object-contain" />
        </span>
        <Image
          src="/logoletters.png"
          alt=""
          width={250}
          height={50}
          style={{ width: "auto", height: "2.75rem" }}
          className="header-logotype object-contain"
        />
      </Link>

      <p className="mt-4 text-sm font-medium text-foreground/60">{t("footerTagline")}</p>

      <nav className="mt-5 flex items-center justify-center gap-5 text-sm font-semibold text-foreground/70">
        {LINKS.map(({ href, key }) => (
          <Link key={key} href={href} className="transition-colors hover:text-aqua">
            {tNav(key)}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
