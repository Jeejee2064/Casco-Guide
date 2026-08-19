import { DAY_KEYS, type DayKey, type DayHours, type Spot } from "@/lib/types/database";

export type HoursStatus =
  | { state: "open"; closesAt: string }
  | { state: "closing-soon"; closesAt: string }
  | { state: "opens-later"; opensAt: string }
  | { state: "closed" };

const PANAMA_TZ = "America/Panama"; // UTC-5, no DST

function nowInPanama(): Date {
  // Build a Date whose getHours/getMinutes/getDay reflect Panama local time,
  // regardless of the server/browser's own timezone.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PANAMA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return new Date(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")),
    Number(get("minute")),
    Number(get("second")),
  );
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function formatTime(hhmm: string, locale: string = "en"): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return new Intl.DateTimeFormat(locale === "es" ? "es-PA" : "en-US", {
    hour: "numeric",
    minute: m === 0 ? undefined : "2-digit",
    hour12: true,
  }).format(d);
}

export function getDayHours(spot: Spot, day: DayKey): DayHours {
  const column = `hours_${day}` as const;
  return spot[column] as DayHours;
}

/**
 * Computes the live open/closed status of a spot for "right now" in
 * Panama's timezone. Supports multi-slot days (e.g. lunch + dinner).
 */
export function getHoursStatus(spot: Spot, closingSoonWindowMin = 30): HoursStatus {
  const now = nowInPanama();
  const todayIndex = (now.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const today = DAY_KEYS[todayIndex];
  const todaySlots = getDayHours(spot, today);

  if (todaySlots) {
    for (const slot of todaySlots) {
      const openMin = toMinutes(slot.open);
      const closeMin = toMinutes(slot.close);
      if (nowMin >= openMin && nowMin < closeMin) {
        if (closeMin - nowMin <= closingSoonWindowMin) {
          return { state: "closing-soon", closesAt: slot.close };
        }
        return { state: "open", closesAt: slot.close };
      }
    }
    // Not open yet in a later slot today?
    const upcoming = todaySlots
      .filter((slot) => toMinutes(slot.open) > nowMin)
      .sort((a, b) => toMinutes(a.open) - toMinutes(b.open))[0];
    if (upcoming) {
      return { state: "opens-later", opensAt: upcoming.open };
    }
  }

  // Look ahead up to 7 days for the next opening slot.
  for (let offset = 1; offset <= 7; offset++) {
    const dayIndex = (todayIndex + offset) % 7;
    const slots = getDayHours(spot, DAY_KEYS[dayIndex]);
    if (slots && slots.length > 0) {
      const first = [...slots].sort((a, b) => toMinutes(a.open) - toMinutes(b.open))[0];
      return { state: "opens-later", opensAt: first.open };
    }
  }

  return { state: "closed" };
}

export function isOpenNow(spot: Spot): boolean {
  const status = getHoursStatus(spot);
  return status.state === "open" || status.state === "closing-soon";
}

/** Formats a day's slots as "10am–1pm, 3pm–9pm" or "Closed". */
export function formatDaySlots(slots: DayHours, locale: string = "en"): string {
  if (!slots || slots.length === 0) {
    return locale === "es" ? "Cerrado" : "Closed";
  }
  return slots
    .map((s) => `${formatTime(s.open, locale)}–${formatTime(s.close, locale)}`)
    .join(", ");
}
