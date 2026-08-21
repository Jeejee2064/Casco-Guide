import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { CATEGORY_META } from "@/lib/categories";
import type { SpotCategory } from "@/lib/types/database";

export function CategoryBadge({ category }: { category: SpotCategory }) {
  const t = useTranslations("category");
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  return (
    <Badge
      className="text-white shadow-sm"
      style={{
        // Diagonal gradient instead of a flat fill — same category color,
        // a touch more depth to match the filter bar chips' active state.
        background: `linear-gradient(135deg, ${meta.color}, color-mix(in srgb, ${meta.color} 68%, black))`,
      }}
    >
      <Icon size={13} strokeWidth={2.5} />
      {t(category)}
    </Badge>
  );
}
