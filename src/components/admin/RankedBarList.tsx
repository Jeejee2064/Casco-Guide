/**
 * Ranked "top N" bar list — spots/articles by views, devices/language by
 * share. One shared shape for the admin Analytics tab's list-style panels:
 * label + proportional bar (relative to the list's own max, not a global
 * scale) + raw count. Sequential magnitude (one hue) by default; pass
 * `colorFor` for the fixed-order categorical case (device/language).
 */
export function RankedBarList({
  title,
  items,
  emptyLabel,
  colorFor,
}: {
  title: string;
  items: { label: string; count: number }[];
  emptyLabel: string;
  colorFor?: (index: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
      <h2 className="mb-4 font-heading text-sm font-extrabold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-foreground/50">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                <span className="truncate">{item.label}</span>
                <span className="shrink-0 tabular-nums text-foreground/50">{item.count}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/8">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(item.count / max) * 100}%`,
                    background: colorFor ? colorFor(i) : "var(--color-aqua)",
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
