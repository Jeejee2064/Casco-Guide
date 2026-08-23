"use client";

import { useId, useState } from "react";

type TrendPoint = { date: string; count: number };

const WIDTH = 600;
const HEIGHT = 160;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;
const PAD_X = 4;

/**
 * Daily pageviews over the window — single series, so no legend (the title
 * above it in the page already names it). Thin 2px line, a soft area fill
 * under it for readability, recessive day-of-month ticks, and a hover
 * crosshair + tooltip on the nearest point (see the dataviz interaction
 * guidance this project follows: any SVG/HTML chart ships with a hover
 * layer by default).
 */
export function PageviewTrendChart({ data, emptyLabel }: { data: TrendPoint[]; emptyLabel: string }) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.count), 1);
  const innerWidth = WIDTH - PAD_X * 2;
  const innerHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = data.length > 1 ? innerWidth / (data.length - 1) : 0;

  const xAt = (i: number) => PAD_X + i * stepX;
  const yAt = (count: number) => PAD_TOP + innerHeight - (count / max) * innerHeight;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(d.count)}`).join(" ");
  const areaPath = `${linePath} L ${xAt(data.length - 1)} ${PAD_TOP + innerHeight} L ${xAt(0)} ${PAD_TOP + innerHeight} Z`;

  const totalCount = data.reduce((sum, d) => sum + d.count, 0);
  if (totalCount === 0) {
    return (
      <div className="flex h-[160px] items-center justify-center text-sm text-foreground/50">
        {emptyLabel}
      </div>
    );
  }

  // A handful of evenly-spaced day-of-month ticks — enough to orient
  // without cluttering a 30-point axis with 30 labels.
  const tickEvery = Math.max(1, Math.round(data.length / 6));
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
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-aqua)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-aqua)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-aqua)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Day-of-month ticks — recessive, text tokens only (never the
            series color, per this project's chart convention). */}
        {data.map((d, i) =>
          i % tickEvery === 0 ? (
            <text
              key={d.date}
              x={xAt(i)}
              y={HEIGHT - 6}
              fontSize={9}
              textAnchor="middle"
              fill="currentColor"
              className="text-foreground/40"
            >
              {new Date(d.date + "T00:00:00Z").getUTCDate()}
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
              cy={yAt(hovered.count)}
              r={4}
              fill="var(--color-aqua)"
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
          <p className="font-bold tabular-nums">{hovered.count.toLocaleString()}</p>
          <p className="text-foreground/50">
            {new Date(hovered.date + "T00:00:00Z").toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
            })}
          </p>
        </div>
      )}
    </div>
  );
}
