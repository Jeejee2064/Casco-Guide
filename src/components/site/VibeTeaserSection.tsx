import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { VIBE_META, SPOT_VIBES } from "@/lib/vibes";

/**
 * Homepage teaser into vibes mode. Two columns: the pitch and CTA on the
 * left (sticky on desktop), the six vibes as a plain ruled list on the right
 * — name, descriptor and a colored icon per row, no cards, so it reads as a
 * different beat from the card grids around it. Each row deep-links to
 * /spots with that vibe pre-selected (`?vibe=<id>`); the CTA opens the
 * picker with nothing chosen (`?mode=vibes&vibesModal=1`), both read
 * server-side by spots/page.tsx.
 */
export async function VibeTeaserSection() {
  const [t, tVibe, tDescriptor] = await Promise.all([
    getTranslations("home.vibeTeaser"),
    getTranslations("vibe"),
    getTranslations("vibeDescriptors"),
  ]);

  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[5fr_7fr] lg:gap-16">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <h2 className="font-heading text-3xl font-extrabold leading-tight sm:text-4xl">
          {t("title")}
        </h2>
        <p className="mt-3 max-w-md text-foreground/65">{t("subtitle")}</p>
        <Link
          href={{ pathname: "/spots", query: { mode: "vibes", vibesModal: "1" } }}
          className="group mt-6 inline-flex items-center gap-2 rounded-full bg-aqua px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-aqua-dark"
        >
          {t("cta")}
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      <ul className="divide-y divide-border border-y border-border">
        {SPOT_VIBES.map((v) => {
          const meta = VIBE_META[v];
          const Icon = meta.icon;
          return (
            <li key={v}>
              <Link
                href={{ pathname: "/spots", query: { vibe: v } }}
                className="group flex items-center gap-4 py-4 sm:gap-5 sm:py-5"
              >
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110"
                  style={{ background: `${meta.color}26`, color: meta.color }}
                >
                  <Icon size={22} strokeWidth={2.25} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-lg font-bold">{tVibe(v)}</span>
                  <span className="mt-0.5 block text-sm text-foreground/60">{tDescriptor(v)}</span>
                </span>
                <ArrowRight
                  size={18}
                  className="shrink-0 text-foreground/30 transition-all group-hover:translate-x-1 group-hover:text-aqua"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
