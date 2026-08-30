import { useMemo, useRef, useState } from 'react';
import type { MetricSeries } from '@bestchain/shared';
import { bytes, percent } from '../format.js';

const WIDTH = 640;
const HEIGHT = 140;
const PAD = { top: 12, right: 12, bottom: 20, left: 44 };

function formatValue(value: number, unit: string): string {
  if (unit === 'bytes') return bytes(value);
  if (unit === 'ratio') return percent(value);
  if (unit === 'ops/s') return `${value.toFixed(value < 10 ? 2 : 0)}/s`;
  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

function formatTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * One metric, one series — so identity comes from the title and no legend or
 * categorical palette is needed. Six of these render as small multiples on the
 * /developer page; they deliberately share a single series color rather than
 * cycling hues, which would put more colors on screen than a palette can keep
 * distinguishable.
 */
export function MetricChart({ series, title }: { series: MetricSeries; title: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const geometry = useMemo(() => {
    const points = series.points;
    if (points.length === 0) return null;

    const values = points.map((p) => p.v);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    // A flat series would collapse to a zero-height band; give it breathing room.
    const span = rawMax - rawMin || Math.abs(rawMax) || 1;
    const min = series.unit === 'ratio' ? Math.max(0, rawMin - span * 0.1) : rawMin - span * 0.1;
    const max = rawMax + span * 0.1;

    const plotW = WIDTH - PAD.left - PAD.right;
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const x = (i: number) =>
      PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const y = (v: number) => PAD.top + plotH - ((v - min) / (max - min)) * plotH;

    const line = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p.v).toFixed(2)}`)
      .join(' ');
    const area = `${line} L${x(points.length - 1).toFixed(2)},${(PAD.top + plotH).toFixed(2)} L${x(0).toFixed(2)},${(PAD.top + plotH).toFixed(2)} Z`;

    return { points, min, max, x, y, line, area, plotH };
  }, [series]);

  if (!geometry) {
    return (
      <figure className="chart chart--empty">
        <figcaption>{title}</figcaption>
        <p className="chart__empty">no samples — is prometheus scraping postgres_exporter?</p>
      </figure>
    );
  }

  const { points, min, max, x, y, line, area, plotH } = geometry;
  const latest = points[points.length - 1]!;
  const active = hoverIndex === null ? null : points[hoverIndex];

  const handleMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const plotStart = PAD.left / WIDTH;
    const plotEnd = (WIDTH - PAD.right) / WIDTH;
    const clamped = Math.min(Math.max((ratio - plotStart) / (plotEnd - plotStart), 0), 1);
    setHoverIndex(Math.round(clamped * (points.length - 1)));
  };

  return (
    <figure className="chart">
      <figcaption>
        <span className="chart__title">{title}</span>
        {/* Selective direct label: the latest value only, never one per point. */}
        <span className="chart__latest">{formatValue(latest.v, series.unit)}</span>
      </figcaption>

      <div className="chart__plot">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title}, latest ${formatValue(latest.v, series.unit)}`}
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {[0, 0.5, 1].map((fraction) => {
            const gy = PAD.top + fraction * plotH;
            return (
              <line
                key={fraction}
                className="chart__grid"
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={gy}
                y2={gy}
              />
            );
          })}

          <path className="chart__area" d={area} />
          <path className="chart__line" d={line} />

          {active && hoverIndex !== null && (
            <>
              <line
                className="chart__crosshair"
                x1={x(hoverIndex)}
                x2={x(hoverIndex)}
                y1={PAD.top}
                y2={PAD.top + plotH}
              />
              {/* 2px surface ring keeps the marker legible where it overlaps the line. */}
              <circle className="chart__marker" cx={x(hoverIndex)} cy={y(active.v)} r={5} />
            </>
          )}

          <text className="chart__tick" x={PAD.left - 6} y={PAD.top + 4} textAnchor="end">
            {formatValue(max, series.unit)}
          </text>
          <text className="chart__tick" x={PAD.left - 6} y={PAD.top + plotH} textAnchor="end">
            {formatValue(min, series.unit)}
          </text>
          <text className="chart__tick" x={PAD.left} y={HEIGHT - 6}>
            {formatTime(points[0]!.t)}
          </text>
          <text className="chart__tick" x={WIDTH - PAD.right} y={HEIGHT - 6} textAnchor="end">
            {formatTime(latest.t)}
          </text>
        </svg>

        {active && (
          <div
            className="chart__tooltip"
            style={{ left: `${(x(hoverIndex!) / WIDTH) * 100}%` }}
            role="status"
          >
            <strong>{formatValue(active.v, series.unit)}</strong>
            <span>{formatTime(active.t)}</span>
          </div>
        )}
      </div>
    </figure>
  );
}

/** The accessible equivalent of the chart above — same numbers, no color needed. */
export function MetricTable({ series, title }: { series: MetricSeries; title: string }) {
  return (
    <figure className="chart">
      <figcaption>
        <span className="chart__title">{title}</span>
      </figcaption>
      <div className="table-scroll table-scroll--short">
        <table>
          <thead>
            <tr>
              <th scope="col">time</th>
              <th scope="col">value</th>
            </tr>
          </thead>
          <tbody>
            {series.points.map((point) => (
              <tr key={point.t}>
                <td>{formatTime(point.t)}</td>
                <td className="num">{formatValue(point.v, series.unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
