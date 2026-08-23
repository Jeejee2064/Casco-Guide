import type { LucideIcon } from "lucide-react";

/** One KPI card — same visual language as the dashboard's own stat cards
 * (AdminDashboardPage), reused here so the Analytics tab reads as part of
 * the same admin, not a bolted-on tool. `sub`, when given, is a small
 * secondary line under the value (a rate, a share of another number). */
export function AnalyticsStatTile({
  label,
  value,
  icon: Icon,
  className,
  sub,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  className: string;
  sub?: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${className}`}>
        <Icon size={18} />
      </div>
      <p className="font-heading text-2xl font-extrabold">{value.toLocaleString()}</p>
      <p className="text-sm text-foreground/60">{label}</p>
      {sub && <p className="mt-1 text-xs text-foreground/45">{sub}</p>}
    </div>
  );
}
