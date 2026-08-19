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
      style={{ backgroundColor: meta.color }}
    >
      <Icon size={13} strokeWidth={2.5} />
      {t(category)}
    </Badge>
  );
}
