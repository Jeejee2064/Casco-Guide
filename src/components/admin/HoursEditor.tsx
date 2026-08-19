"use client";

import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { DAY_KEYS, type DayHours, type DayKey } from "@/lib/types/database";

type WeekHours = Record<DayKey, DayHours>;

export function HoursEditor({
  value,
  onChange,
}: {
  value: WeekHours;
  onChange: (next: WeekHours) => void;
}) {
  const th = useTranslations("hours");
  const tf = useTranslations("admin.spotForm");

  const setDay = (day: DayKey, slots: DayHours) => {
    onChange({ ...value, [day]: slots });
  };

  const toggleClosed = (day: DayKey, closed: boolean) => {
    setDay(day, closed ? null : [{ open: "09:00", close: "18:00" }]);
  };

  const updateSlot = (day: DayKey, index: number, field: "open" | "close", val: string) => {
    const slots = value[day] ?? [];
    const next = slots.map((s, i) => (i === index ? { ...s, [field]: val } : s));
    setDay(day, next);
  };

  const addSlot = (day: DayKey) => {
    setDay(day, [...(value[day] ?? []), { open: "09:00", close: "18:00" }]);
  };

  const removeSlot = (day: DayKey, index: number) => {
    const slots = (value[day] ?? []).filter((_, i) => i !== index);
    setDay(day, slots.length ? slots : null);
  };

  return (
    <div className="space-y-2">
      {DAY_KEYS.map((day) => {
        const slots = value[day];
        const closed = !slots || slots.length === 0;
        return (
          <div
            key={day}
            className="flex flex-col gap-2 rounded-[var(--radius-button)] border border-border p-3 sm:flex-row sm:items-center"
          >
            <label className="flex w-32 shrink-0 items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={!closed}
                onChange={(e) => toggleClosed(day, !e.target.checked)}
                className="h-4 w-4 accent-aqua"
              />
              {th(`days.${day}`)}
            </label>

            {closed ? (
              <span className="text-sm text-foreground/40">{tf("closedToday")}</span>
            ) : (
              <div className="flex flex-1 flex-col gap-2">
                {slots!.map((slot, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={slot.open}
                      onChange={(e) => updateSlot(day, i, "open", e.target.value)}
                      className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
                    />
                    <span className="text-foreground/40">–</span>
                    <input
                      type="time"
                      value={slot.close}
                      onChange={(e) => updateSlot(day, i, "close", e.target.value)}
                      className="h-9 rounded-lg border border-border bg-surface px-2 text-sm"
                    />
                    {slots!.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSlot(day, i)}
                        className="text-coral"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSlot(day)}
                  className="flex w-fit items-center gap-1 text-xs font-semibold text-aqua-dark dark:text-aqua"
                >
                  <Plus size={13} /> {tf("addSlot")}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
