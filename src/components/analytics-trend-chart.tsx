"use client";

import { useRef, useState } from "react";
import { formatTaka } from "@/lib/utils";

type Point = { label: string; value: number };
type Unit = "currency" | "orders" | "people";

// Functions can't cross the server→client boundary as props, so formatting
// is a fixed unit discriminator here rather than a formatter passed in.
function formatByUnit(unit: Unit, value: number): string {
  if (unit === "currency") return `৳ ${formatTaka(value)}`;
  if (unit === "orders") return `${value}টি`;
  return `${value} জন`;
}

// Rounds a max value up to a "clean" gridline number (1/2/5 × 10^n) so axis
// ticks read as 0 / 1,000 / 2,000 rather than an arbitrary data-driven max.
function niceMax(value: number): number {
  if (value <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function AnalyticsTrendChart({
  title,
  points,
  color,
  unit,
  maxLabels = 8,
}: {
  title: string;
  points: Point[];
  color: string;
  unit: Unit;
  maxLabels?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const width = 600;
  const height = 220;
  const padding = { top: 16, right: 12, bottom: 24, left: 12 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const max = niceMax(Math.max(...points.map((p) => p.value), 1));
  const n = points.length;
  const stepX = n > 1 ? plotWidth / (n - 1) : 0;

  function xAt(i: number) {
    return padding.left + i * stepX;
  }
  function yAt(value: number) {
    return padding.top + plotHeight - (value / max) * plotHeight;
  }

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p.value)}`).join(" ");
  const areaPath = `${linePath} L${xAt(n - 1)},${padding.top + plotHeight} L${xAt(0)},${padding.top + plotHeight} Z`;

  // Show every k-th x-axis label so labels never crowd/overlap on narrow screens.
  const labelStride = Math.max(1, Math.ceil(n / maxLabels));

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    const xInPlot = fraction * width;
    const index = Math.round((xInPlot - padding.left) / (stepX || 1));
    setHoverIndex(Math.min(n - 1, Math.max(0, index)));
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const gridLines = [0.25, 0.5, 0.75, 1];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-700">{title}</h3>
        {hovered && (
          <div className="text-right text-xs">
            <span className="font-bold text-gray-500">{hovered.label}: </span>
            <span className="font-extrabold text-gray-900">{formatByUnit(unit, hovered.value)}</span>
          </div>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none"
        style={{ aspectRatio: `${width} / ${height}` }}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {gridLines.map((g) => (
          <line
            key={g}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotHeight * (1 - g)}
            y2={padding.top + plotHeight * (1 - g)}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
        ))}

        <path d={areaPath} fill={color} fillOpacity={0.1} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) =>
          i % labelStride === 0 || i === n - 1 ? (
            <text
              key={`label-${i}`}
              x={xAt(i)}
              y={height - 6}
              fontSize={10}
              textAnchor="middle"
              fill="#9ca3af"
              fontWeight={600}
            >
              {p.label}
            </text>
          ) : null
        )}

        {/* End-of-line marker with the direct value label, per mark spec. */}
        <circle cx={xAt(n - 1)} cy={yAt(points[n - 1]?.value ?? 0)} r={4} fill={color} stroke="#fff" strokeWidth={2} />

        {hoverIndex !== null && (
          <>
            <line
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={padding.top}
              y2={padding.top + plotHeight}
              stroke="#9ca3af"
              strokeWidth={1}
            />
            <circle
              cx={xAt(hoverIndex)}
              cy={yAt(points[hoverIndex].value)}
              r={5}
              fill={color}
              stroke="#fff"
              strokeWidth={2}
            />
          </>
        )}
      </svg>
    </div>
  );
}
