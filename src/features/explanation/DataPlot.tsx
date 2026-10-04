import { useEffect, useRef, useState } from 'react';
import { pl } from '../../i18n/pl';
import { clamp } from './labMath';
const t = pl.explanation;
export interface PlotSeries {
  label: string;
  values: ArrayLike<number>;
  color: string;
}
export function DataPlot({
  title,
  series,
  xLabel,
  yLabel,
  xValues,
  zoom = true,
  domain,
  markers = [],
}: {
  title: string;
  series: PlotSeries[];
  xLabel: string;
  yLabel: string;
  xValues?: number[];
  zoom?: boolean;
  domain?: [number, number];
  markers?: { index: number; label: string }[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const count = Math.max(0, ...series.map((s) => s.values.length));
  const [range, setRange] = useState<[number, number]>([0, Math.max(0, count - 1)]);
  const [point, setPoint] = useState(0);
  const start = clamp(range[0], 0, Math.max(0, count - 1)),
    end = clamp(range[1], start, Math.max(0, count - 1));
  let min = domain?.[0] ?? 0,
    max = domain?.[1] ?? 0;
  if (!domain)
    for (const s of series)
      for (let i = start; i <= end; i++) {
        min = Math.min(min, s.values[i] ?? 0);
        max = Math.max(max, s.values[i] ?? 0);
      }
  const extent = max - min || 1;
  useEffect(() => {
    const canvas = ref.current!,
      ctx = canvas.getContext('2d')!;
    canvas.width = 800;
    canvas.height = 290;
    ctx.clearRect(0, 0, 800, 290);
    const firstX = xValues?.[start] ?? start,
      lastX = xValues?.[end] ?? end;
    const x = (i: number) => 65 + (((xValues?.[i] ?? i) - firstX) / (lastX - firstX || 1)) * 710;
    const y = (v: number) => 240 - ((v - min) / extent) * 215;
    ctx.font = '13px Segoe UI';
    ctx.fillStyle = '#61716c';
    ctx.strokeStyle = '#cbd3c5';
    ctx.lineWidth = 1;
    for (let tick = 0; tick <= 4; tick++) {
      const value = min + (tick * extent) / 4;
      ctx.beginPath();
      ctx.moveTo(65, y(value));
      ctx.lineTo(775, y(value));
      ctx.stroke();
      ctx.fillText(value.toLocaleString('pl-PL', { maximumFractionDigits: 2 }), 2, y(value) + 4);
    }
    for (let tick = 0; tick <= 4; tick++) {
      const i = Math.round(start + (tick / 4) * (end - start));
      ctx.fillText(
        (xValues?.[i] ?? i).toLocaleString('pl-PL', { maximumFractionDigits: 2 }),
        x(i) - 12,
        266,
      );
    }
    for (const s of series) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = start; i <= end; i++) {
        if (i === start) ctx.moveTo(x(i), y(s.values[i] ?? 0));
        else ctx.lineTo(x(i), y(s.values[i] ?? 0));
      }
      ctx.stroke();
      if (count === 1) {
        ctx.beginPath();
        ctx.arc(x(0), y(s.values[0] ?? 0), 4, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();
      }
    }
    for (const marker of markers)
      if (marker.index >= start && marker.index <= end) {
        ctx.strokeStyle = '#172f2c';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x(marker.index), 20);
        ctx.lineTo(x(marker.index), 240);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    if (count) {
      ctx.strokeStyle = '#172f2c';
      ctx.beginPath();
      ctx.moveTo(x(clamp(point, start, end)), 20);
      ctx.lineTo(x(clamp(point, start, end)), 240);
      ctx.stroke();
    }
    return () => {
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [series, start, end, min, extent, point, count, xValues, markers]);
  const selected = clamp(point, start, end);
  return (
    <figure className="lab-plot">
      <figcaption>
        <strong>{title}</strong>
        <small>{yLabel}</small>
      </figcaption>
      <canvas
        ref={ref}
        role="img"
        tabIndex={0}
        aria-label={`${title}. ${xLabel}; ${yLabel}`}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const fraction = clamp(
            (((event.clientX - rect.left) / rect.width) * 800 - 65) / 710,
            0,
            1,
          );
          if (xValues) {
            const target = xValues[start] + fraction * (xValues[end] - xValues[start]);
            let closest = start;
            for (let i = start + 1; i <= end; i++)
              if (Math.abs(xValues[i] - target) < Math.abs(xValues[closest] - target)) closest = i;
            setPoint(closest);
          } else setPoint(Math.round(start + fraction * (end - start)));
        }}
        onKeyDown={(event) => {
          if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
            event.preventDefault();
            setPoint(clamp(selected + (event.key === 'ArrowRight' ? 1 : -1), start, end));
          }
        }}
      />
      <div className="plot-axis">{xLabel}</div>
      <div className="plot-legend">
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <output className="plot-tooltip">
        {xLabel}: {(xValues?.[selected] ?? selected).toFixed(xValues ? 2 : 0)} ·{' '}
        {series.map((s) => `${s.label}: ${Number(s.values[selected] ?? 0).toFixed(4)}`).join(' · ')}{' '}
        {markers
          .filter((m) => m.index === selected)
          .map((m) => m.label)
          .join(' ')}
      </output>
      {zoom && count > 1 && (
        <div className="plot-range">
          <label>
            {t.rangeStart}
            <input
              type="range"
              min={0}
              max={count - 1}
              value={start}
              onChange={(e) =>
                setRange([Number(e.target.value), Math.max(end, Number(e.target.value))])
              }
            />
          </label>
          <label>
            {t.rangeEnd}
            <input
              type="range"
              min={0}
              max={count - 1}
              value={end}
              onChange={(e) =>
                setRange([Math.min(start, Number(e.target.value)), Number(e.target.value)])
              }
            />
          </label>
          <button onClick={() => setRange([0, count - 1])}>{t.resetZoom}</button>
        </div>
      )}
    </figure>
  );
}

export function Heatmap({
  values,
  title,
  columns = Math.ceil(Math.sqrt(values.length)),
  spatial = false,
}: {
  values: Float32Array;
  title: string;
  columns?: number;
  spatial?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState(0);
  const rows = Math.ceil(values.length / columns) || 1;
  let min = Infinity,
    max = -Infinity;
  for (const value of values) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  useEffect(() => {
    const canvas = ref.current!,
      ctx = canvas.getContext('2d')!;
    const cell = Math.max(1, Math.min(8, Math.floor(512 / Math.max(1, columns))));
    canvas.width = Math.max(1, columns) * cell;
    canvas.height = rows * cell;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < values.length; i++) {
      const intensity = (values[i] - min) / (max - min || 1);
      ctx.fillStyle = `rgb(${Math.round(236 - intensity * 211)}, ${Math.round(240 - intensity * 143)}, ${Math.round(225 - intensity * 171)})`;
      ctx.fillRect((i % columns) * cell, Math.floor(i / columns) * cell, cell, cell);
    }
    return () => {
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [values, columns, rows, min, max]);
  return (
    <figure className="lab-heatmap">
      <figcaption>
        {title} · {columns} × {rows}
      </figcaption>
      <canvas
        ref={ref}
        role="img"
        tabIndex={0}
        aria-label={title}
        onPointerMove={(event) => {
          const r = event.currentTarget.getBoundingClientRect();
          const x = clamp(
              Math.floor(((event.clientX - r.left) / r.width) * columns),
              0,
              columns - 1,
            ),
            y = clamp(Math.floor(((event.clientY - r.top) / r.height) * rows), 0, rows - 1);
          setSelected(y * columns + x);
        }}
        onKeyDown={(event) => {
          if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
            event.preventDefault();
            setSelected(
              clamp(selected + (event.key === 'ArrowRight' ? 1 : -1), 0, values.length - 1),
            );
          }
        }}
      />
      <output>
        {selected < values.length
          ? `${spatial ? `${selected % columns}, ${Math.floor(selected / columns)}` : `${t.feature} #${selected}`} · ${t.value}: ${values[selected].toFixed(5)}`
          : t.emptyCell}
      </output>
      <small>
        {t.value}: {Number.isFinite(min) ? min.toFixed(3) : 0} →{' '}
        {Number.isFinite(max) ? max.toFixed(3) : 0} · {t.gridAxes}
      </small>
    </figure>
  );
}
