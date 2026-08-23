"use client";

import { useState } from "react";

type TrendPoint = { date: string; pageviews: number; visitors: number };
type RangeKey = "today" | "last7" | "last30";

const WIDTH = 600;
const HEIGHT = 220;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const PAD_LEFT = 34;
const PAD_RIGHT = 8;
const Y_TICKS = 4;

// Two series, one shared axis (both are plain counts) rather than a
// dual-y-axis chart — see the note on TrendPoint in posthog-server.ts for
// why. Fixed-order pair, not generated: pageviews first (the volume
// metric), visitors second.
const PAGEVIEWS_COLOR = "var(--color-aqua)";
const VISITORS_COLOR = "var(--color-coral)";

// A "nice" round step for the requested tick count — 1/2/5/10/20/50/100...
// rather than whatever ugly fraction `max / tickCount` lands on, so the
// y-axis reads 0/10/20/30 instead of 0/8.5/17/25.5.
function niceStep(max: number, tickCount: number): number {
  const raw = max / tickCount || 1;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

function isHourly(point: TrendPoint) {
  return point.date.length > 10;
}

function formatAxisLabel(point: TrendPoint, locale: string | undefined) {
  const d = new Date(point.date + (isHourly(point) ? "Z" : "T00:00:00Z"));
  return isHourly(point)
    ? d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
    : d.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });
}

function formatTooltipLabel(point: TrendPoint, locale: string | undefined) {
  const d = new Date(point.date + (isHourly(point) ? "Z" : "T00:00:00Z"));
  return isHourly(point)
    ? d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
    : d.toLocaleDateString(locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      });
}

function Legend({ pageviewsLabel, visitorsLabel }: { pageviewsLabel: string; visitorsLabel: string }) {
  return (
    <div className="flex items-center gap-4 text-xs font-semibold text-foreground/60">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: PAGEVIEWS_COLOR }} />
        {pageviewsLabel}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: VISITORS_COLOR }} />
        {visitorsLabel}
      </span>
    </div>
  );
}

function Chart({ data, emptyLabel }: { data: TrendPoint[]; emptyLabel: string }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const totalCount = data.reduce((sum, d) => sum + d.pageviews + d.visitors, 0);
  if (totalCount === 0 || data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-foreground/50">
        {emptyLabel}
      </div>
    );
  }

  const rawMax = Math.max(...data.map((d) => Math.max(d.pageviews, d.visitors)));
  const step = niceStep(rawMax, Y_TICKS);
  const axisMax = step * Y_TICKS;

  const innerWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = data.length > 1 ? innerWidth / (data.length - 1) : 0;

  const xAt = (i: number) => PAD_LEFT + i * stepX;
  const yAt = (count: number) => PAD_TOP + innerHeight - (count / axisMax) * innerHeight;

  const pathFor = (key: "pageviews" | "visitors") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(d[key])}`).join(" ");

  // A handful of evenly-spaced x ticks — enough to orient (which day/hour
  // this is) without crowding a 24- or 30-point axis with a label per point.
  const xTickEvery = Math.max(1, Math.round(data.length / 6));
  const yTickValues = Array.from({ length: Y_TICKS + 1 }, (_, i) => i * step);

  const hovered = hoverIndex != null ? data[hoverIndex] : null;

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const i = Math.round(ratio * (data.length - 1));
    setHoverIndex(Math.min(Math.max(i, 0), data.length - 1));
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full touch-none"
        role="img"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {/* Y-axis gridlines + labels — recessive, text tokens only (never
            a series color), so they orient without competing with the
            lines themselves. */}
        {yTickValues.map((value) => (
          <g key={value}>
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yAt(value)}
              y2={yAt(value)}
              stroke="currentColor"
              className="text-foreground/10"
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - 8}
              y={yAt(value)}
              dy={3}
              fontSize={10}
              textAnchor="end"
              fill="currentColor"
              className="text-foreground/45 tabular-nums"
            >
              {value.toLocaleString()}
            </text>
          </g>
        ))}

        <path
          d={pathFor("pageviews")}
          fill="none"
          stroke={PAGEVIEWS_COLOR}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={pathFor("visitors")}
          fill="none"
          stroke={VISITORS_COLOR}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* X-axis ticks */}
        {data.map((d, i) =>
          i % xTickEvery === 0 || i === data.length - 1 ? (
            <text
              key={d.date}
              x={xAt(i)}
              y={HEIGHT - 8}
              fontSize={10}
              textAnchor={i === data.length - 1 ? "end" : i === 0 ? "start" : "middle"}
              fill="currentColor"
              className="text-foreground/45"
            >
              {formatAxisLabel(d, undefined)}
            </text>
          ) : null,
        )}

        {hovered && hoverIndex != null && (
          <>
            <line
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={PAD_TOP}
              y2={PAD_TOP + innerHeight}
              stroke="currentColor"
              className="text-foreground/15"
              strokeWidth={1}
            />
            <circle
              cx={xAt(hoverIndex)}
              cy={yAt(hovered.pageviews)}
              r={4}
              fill={PAGEVIEWS_COLOR}
              stroke="var(--surface)"
              strokeWidth={2}
            />
            <circle
              cx={xAt(hoverIndex)}
              cy={yAt(hovered.visitors)}
              r={4}
              fill={VISITORS_COLOR}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          </>
        )}
      </svg>

      {hovered && hoverIndex != null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-[var(--radius-button)] border border-border bg-surface px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: `${(xAt(hoverIndex) / WIDTH) * 100}%`,
          }}
        >
          <p className="flex items-center gap-1.5 font-bold tabular-nums">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: PAGEVIEWS_COLOR }} />
            {hovered.pageviews.toLocaleString()}
          </p>
          <p className="flex items-center gap-1.5 font-bold tabular-nums">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: VISITORS_COLOR }} />
            {hovered.visitors.toLocaleString()}
          </p>
          <p className="mt-0.5 text-foreground/50">{formatTooltipLabel(hovered, undefined)}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Pageviews and unique visitors, overlaid on one shared axis (never a
 * dual-y-axis chart — see the note on TrendPoint), with a range switch
 * above it. All three ranges are fetched once server-side (see the
 * analytics page) and handed to this client component together, so
 * switching range is instant — no round trip.
 */
export function PageviewTrendChart({
  series,
  labels,
}: {
  series: { today: TrendPoint[]; last7: TrendPoint[]; last30: TrendPoint[] };
  labels: {
    today: string;
    last7: string;
    last30: string;
    empty: string;
    pageviews: string;
    visitors: string;
  };
}) {
  const [range, setRange] = useState<RangeKey>("last30");

  const options: { key: RangeKey; label: string }[] = [
    { key: "today", label: labels.today },
    { key: "last7", label: labels.last7 },
    { key: "last30", label: labels.last30 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-border bg-background p-1 text-xs font-semibold">
          {options.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              aria-pressed={range === key}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                range === key ? "bg-aqua text-white" : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Legend pageviewsLabel={labels.pageviews} visitorsLabel={labels.visitors} />
      </div>

      <Chart data={series[range]} emptyLabel={labels.empty} />
    </div>
  );
}
