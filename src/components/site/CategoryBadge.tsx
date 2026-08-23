import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { CATEGORY_META } from "@/lib/categories";
import type { SpotCategory } from "@/lib/types/database";

// Deliberately neutral — category is no longer color-coded anywhere in the
// UI (see ExploreFilterBar's classic chips and SpotMap's neutral pins): the
// icon alone says which category this is, so every category's badge looks
// identical but for the glyph. Translucent black-on-photo works the same way
// this badge is actually used (the single top-left mark over a spot's
// image) and still reads fine on the plain surfaces it also appears on
// (SpotDetailView/Modal, admin tables).
export function CategoryBadge({ category }: { category: SpotCategory }) {
  const t = useTranslations("category");
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  return (
    <Badge className="border border-white/10 bg-black/60 text-white shadow-sm backdrop-blur-md">
      <Icon size={13} strokeWidth={2.5} />
      {t(category)}
    </Badge>
  );
}
