import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { VIBE_META, SPOT_VIBES } from "@/lib/vibes";

/**
 * Homepage teaser into vibes mode — all 6 vibes, every card (and the CTA
 * below) going to /map, not /spots: each mood card deep-links with that one
 * vibe pre-selected (`?vibe=<id>`), the general "Discover your vibe" CTA
 * opens the picker with nothing chosen yet and VibesModal popped open right
 * away (`?mode=vibes&vibesModal=1`) — both read server-side by map/page.tsx.
 */
export async function VibeTeaserSection() {
  const [t, tVibe, tDescriptor] = await Promise.all([
    getTranslations("home.vibeTeaser"),
    getTranslations("vibe"),
    getTranslations("vibeDescriptors"),
  ]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-8 max-w-2xl">
        <h2 className="font-heading text-2xl font-extrabold sm:text-3xl">{t("title")}</h2>
        <p className="mt-2 text-foreground/60">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {SPOT_VIBES.map((v) => {
          const meta = VIBE_META[v];
          const Icon = meta.icon;
          return (
            <Link
              key={v}
              href={{ pathname: "/map", query: { vibe: v } }}
              className="card-lift group flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-5"
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110"
                style={{ background: `${meta.color}26`, color: meta.color }}
              >
                <Icon size={20} strokeWidth={2.25} />
              </span>
              <div>
                <p className="font-heading font-bold">{tVibe(v)}</p>
                <p className="mt-1 text-sm text-foreground/60">{tDescriptor(v)}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Goes to /map (not /spots) and pops VibesModal open right away —
          "Discover your vibe" is asking to see the picker, not just landing
          quietly in vibes mode (see map/page.tsx's ?vibesModal=1). */}
      <Link
        href={{ pathname: "/map", query: { mode: "vibes", vibesModal: "1" } }}
        className="group mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-aqua hover:underline"
      >
        {t("cta")}
        <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
      </Link>
    </section>
  );
}
