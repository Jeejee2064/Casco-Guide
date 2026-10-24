import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { VIBE_META, SPOT_VIBES } from "@/lib/vibes";

/**
 * Homepage teaser into vibes mode. Two columns: the pitch on the
 * left (sticky on desktop), the six vibes as a plain ruled list on the right
 * — name, descriptor and a colored icon per row, no cards, so it reads as a
 * different beat from the card grids around it. Each row deep-links to
 * /spots with that vibe pre-selected (`?vibe=<id>`); read server-side
 * by spots/page.tsx.
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
      </div>

      <ul className="divide-y divide-border border-y-2 border-foreground/15">
        {SPOT_VIBES.map((v) => {
          const meta = VIBE_META[v];
          const Icon = meta.icon;
          return (
            <li key={v}>
              <Link
                href={{ pathname: "/spots", query: { vibe: v } }}
                className="group flex items-center gap-4 py-5 sm:gap-6 sm:py-7"
              >
                <span
                  className="flex h-14 w-14 shrink-0 sm:h-16 sm:w-16 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110"
                  style={{ background: `${meta.color}26`, color: meta.color }}
                >
                  <Icon size={28} strokeWidth={2.25} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-heading text-xl font-extrabold sm:text-2xl">{tVibe(v)}</span>
                  <span className="mt-0.5 block text-sm text-foreground/60 sm:text-base">{tDescriptor(v)}</span>
                </span>
                <ArrowRight
                  size={22}
                  className="shrink-0 text-foreground/40 transition-all group-hover:translate-x-1 group-hover:text-aqua"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
