import { useEffect, useMemo, useRef, useState } from 'react';
import { pl } from '../../i18n/pl';
import type { InferenceSnapshot } from './types';
import { clamp, pixelAt, sourceToInput, tensorPixel, patchBounds, histogram } from './labMath';
import { DataPlot } from './DataPlot';
import { lab } from '../../i18n/lab';
const t = pl.explanation;
export interface Pixel {
  x: number;
  y: number;
}
export function Frame({
  frame,
  label,
  selected,
  onSelect,
  selection,
}: {
  frame: ImageData;
  label: string;
  selection?: { left: number; top: number; width: number; height: number };
  selected?: Pixel;
  onSelect?: (p: Pixel) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(frame, 0, 0);
    if (selection) {
      ctx.strokeStyle = '#172f2c';
      ctx.lineWidth = 3;
      ctx.strokeRect(selection.left, selection.top, selection.width, selection.height);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(selection.left, selection.top, selection.width, selection.height);
    } else if (selected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(selected.x - 4, selected.y - 4, 8, 8);
      ctx.strokeStyle = '#172f2c';
      ctx.lineWidth = 1;
      ctx.strokeRect(selected.x - 6, selected.y - 6, 12, 12);
    }
    return () => {
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [frame, selected, selection]);
  const choose = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onSelect) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onSelect({
      x: clamp(
        Math.floor(((event.clientX - rect.left) / rect.width) * frame.width),
        0,
        frame.width - 1,
      ),
      y: clamp(
        Math.floor(((event.clientY - rect.top) / rect.height) * frame.height),
        0,
        frame.height - 1,
      ),
    });
  };
  return (
    <figure className="explanation-frame">
      <canvas
        ref={ref}
        role="img"
        aria-label={onSelect ? `${label}. ${t.selectPixel}` : label}
        tabIndex={onSelect ? 0 : undefined}
        onPointerMove={(e) => {
          if (!selection || e.buttons === 1) choose(e);
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          choose(e);
        }}
        onKeyDown={(event) => {
          if (
            !onSelect ||
            !selected ||
            !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
          )
            return;
          event.preventDefault();
          onSelect({
            x: clamp(
              selected.x + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0),
              0,
              frame.width - 1,
            ),
            y: clamp(
              selected.y + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0),
              0,
              frame.height - 1,
            ),
          });
        }}
      />
      <figcaption>
        {label} · {frame.width} × {frame.height} px
      </figcaption>
    </figure>
  );
}
export const channelColors = ['#b43f3f', '#24754d', '#306ea9'];
export function HistogramPlot({ snapshot }: { snapshot: InferenceSnapshot }) {
  return (
    <DataPlot
      title={t.histogram}
      series={snapshot.histogram.map((values, i) => ({
        label: 'RGB'[i],
        values,
        color: channelColors[i],
      }))}
      xLabel={t.intensity}
      yLabel={t.pixelCount}
    />
  );
}
export function PixelInspector({
  snapshot,
  selected,
  onSelect,
  detailed,
}: {
  snapshot: InferenceSnapshot;
  selected: Pixel;
  onSelect: (p: Pixel) => void;
  detailed: boolean;
}) {
  const [mode, setMode] = useState(-1);
  const [size, setSize] = useState(8);
  const [cell, setCell] = useState(32);
  const [anchor, setAnchor] = useState(selected);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = snapshot.sourceFrame;
  const bounds = patchBounds(frame, anchor.x, anchor.y, size);
  const { left, top, width, height } = bounds;
  const rgb = pixelAt(frame, selected.x, selected.y);
  const bins = useMemo(() => {
    const patch = new ImageData(width, height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        patch.data.set(
          frame.data.subarray(
            ((top + y) * frame.width + left + x) * 4,
            ((top + y) * frame.width + left + x) * 4 + 4,
          ),
          (y * width + x) * 4,
        );
    return histogram(patch);
  }, [frame, left, top, width, height]);
  useEffect(() => {
    const c = canvas.current!,
      ctx = c.getContext('2d')!;
    c.width = width * cell;
    c.height = height * cell;
    ctx.font = `${Math.min(13, cell / 3)}px Segoe UI`;
    ctx.textAlign = 'center';
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const rgb = pixelAt(frame, left + x, top + y);
        const brightness = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
        const mapped = sourceToInput(left + x, top + y, snapshot.inputMetadata);
        const normalized = mapped
          ? tensorPixel(snapshot.inputValues, snapshot.inputMetadata.width, mapped.x, mapped.y)[0]
          : null;
        const value = mode === 3 ? brightness : mode === 4 ? normalized : rgb[mode];
        const colors =
          mode === -1
            ? rgb
            : mode < 3
              ? rgb.map((v, i) => (i === mode ? v : 0))
              : Array(3).fill(
                  mode === 3 ? brightness : normalized === null ? 90 : (normalized + 1) * 127.5,
                );
        ctx.fillStyle = `rgb(${colors.join(',')})`;
        ctx.fillRect(x * cell, y * cell, cell, cell);
        ctx.strokeStyle = '#ffffff33';
        ctx.lineWidth = 1;
        ctx.strokeRect(x * cell, y * cell, cell, cell);
        if (size <= 8 && cell >= 28 && mode !== -1) {
          ctx.fillStyle = colors.reduce((a, b) => a + b, 0) > 420 ? '#172f2c' : 'white';
          ctx.fillText(
            value == null ? '–' : value.toFixed(mode === 4 ? 2 : 0),
            (x + 0.5) * cell,
            (y + 0.62) * cell,
          );
        }
        if (left + x === selected.x && top + y === selected.y) {
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 3;
          ctx.strokeRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
        }
      }
    return () => {
      c.width = 0;
      c.height = 0;
    };
  }, [frame, snapshot, left, top, width, height, cell, mode, selected, size]);
  const choose = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    onSelect({
      x: left + clamp(Math.floor(((e.clientX - r.left) / r.width) * width), 0, width - 1),
      y: top + clamp(Math.floor(((e.clientY - r.top) / r.height) * height), 0, height - 1),
    });
  };
  return (
    <>
      <div className="pixel-layout">
        <div>
          <Frame
            frame={frame}
            label={t.source}
            selected={{ x: left + Math.floor(width / 2), y: top + Math.floor(height / 2) }}
            selection={bounds}
            onSelect={
              detailed
                ? (p) => {
                    setAnchor(p);
                    onSelect(p);
                  }
                : undefined
            }
          />
          <p>{lab.movePatch}</p>
          <output className="patch-coordinates">
            x: {left}–{left + width - 1} · y: {top}–{top + height - 1} · {width} × {height} px
          </output>
        </div>
        <div>
          <h3>{lab.patch}</h3>
          {detailed && (
            <>
              <label>
                {lab.patchSize}
                <select
                  aria-label={lab.patchSize}
                  value={size}
                  onChange={(e) => {
                    setSize(Number(e.target.value));
                    onSelect(anchor);
                  }}
                >
                  {[4, 8, 16, 32].map((n) => (
                    <option key={n} value={n}>
                      {n} × {n}
                    </option>
                  ))}
                </select>
              </label>
              <div className="segmented">
                {lab.pixelModes.map((label, i) => (
                  <button key={label} aria-pressed={mode === i - 1} onClick={() => setMode(i - 1)}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="patch-zoom">
                <button
                  aria-label={lab.zoomOut}
                  disabled={cell <= 12}
                  onClick={() => setCell((v) => v - 4)}
                >
                  −
                </button>
                <span>
                  {lab.zoom}: {cell} px
                </span>
                <button
                  aria-label={lab.zoomIn}
                  disabled={cell >= 64}
                  onClick={() => setCell((v) => v + 4)}
                >
                  +
                </button>
              </div>
            </>
          )}
          <div className="patch-scroll">
            <canvas
              ref={canvas}
              className="patch-canvas"
              role="img"
              tabIndex={0}
              aria-label={lab.patch}
              style={{ width: width * cell, height: height * cell }}
              onPointerMove={choose}
              onPointerDown={choose}
              onKeyDown={(e) => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
                e.preventDefault();
                onSelect({
                  x: clamp(
                    selected.x + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0),
                    left,
                    left + width - 1,
                  ),
                  y: clamp(
                    selected.y + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0),
                    top,
                    top + height - 1,
                  ),
                });
              }}
            />
          </div>
          <output className="pixel-readout">
            <i style={{ background: `rgb(${rgb.join(',')})` }} />
            {t.pixel} (x: {selected.x}, y: {selected.y})<strong>RGB({rgb.join(', ')})</strong>
          </output>
          {mode === 3 && (
            <p>
              {lab.brightness}: {(0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]).toFixed(3)} ·
              0–255
            </p>
          )}
          {mode >= 0 && mode < 3 && (
            <>
              <p>
                {'RGB'[mode]}: {rgb[mode]} · 0 ─ 255
              </p>
              <DataPlot
                title={lab.patchHistogram}
                series={[{ label: 'RGB'[mode], values: bins[mode], color: channelColors[mode] }]}
                xLabel={t.intensity}
                yLabel={t.pixelCount}
                zoom={false}
              />
            </>
          )}
        </div>
      </div>
      {mode === 4 && (
        <>
          <p className="note">{lab.normalizedPatch}</p>
          <NormalizationInspector snapshot={snapshot} selected={selected} />
        </>
      )}
      {detailed && (
        <details>
          <summary>{t.histogram}</summary>
          <p>{t.histogramHelp}</p>
          <HistogramPlot snapshot={snapshot} />
        </details>
      )}
    </>
  );
}
export function NormalizationInspector({
  snapshot,
  selected,
}: {
  snapshot: InferenceSnapshot;
  selected: Pixel;
}) {
  const rgb = pixelAt(snapshot.sourceFrame, selected.x, selected.y);
  const [value, setValue] = useState<number | null>(null);
  const [channel, setChannel] = useState(0);
  const v = value ?? rgb[channel];
  const m = snapshot.inputMetadata;
  const normalize = (x: number) => x / m.normalization.divisor + m.normalization.offset;
  const mapped = sourceToInput(selected.x, selected.y, m);
  return (
    <section className="normalization-inspector">
      <h3>
        {t.normalization} · ({selected.x}, {selected.y})
      </h3>
      <div className="normalization-values">
        {rgb.map((color, c) => (
          <code key={c}>
            {'RGB'[c]}: {color} / {m.normalization.divisor} − 1 = {normalize(color).toFixed(5)}
          </code>
        ))}
      </div>
      <p>{t.normalizationHelp}</p>
      <label>
        {t.channel}
        <select
          value={channel}
          onChange={(e) => {
            setChannel(Number(e.target.value));
            setValue(null);
          }}
        >
          {['R', 'G', 'B'].map((c, i) => (
            <option key={c} value={i}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="channel-bar">
        {t.cameraValue}: {v}
        <input
          aria-label={t.cameraValue}
          type="range"
          min={0}
          max={255}
          value={v}
          onChange={(e) => setValue(Number(e.target.value))}
        />
        <small>0 → 255</small>
      </label>
      <label className="channel-bar">
        {t.modelValue}: {normalize(v).toFixed(5)}
        <meter min={m.normalizedRange[0]} max={m.normalizedRange[1]} value={normalize(v)} />
        <small>{m.normalizedRange.join(' → ')}</small>
      </label>
      <button onClick={() => setValue(null)}>{t.selectedValue}</button>
      {mapped ? (
        <div className="tensor-readout">
          <p>{t.interpolation}</p>
          <strong>
            {t.tensorValue} [{mapped.y}, {mapped.x}]
          </strong>
          <code>
            {tensorPixel(snapshot.inputValues, m.width, mapped.x, mapped.y)
              .map((value, c) => `${'RGB'[c]} = ${value.toFixed(6)}`)
              .join(' · ')}
          </code>
        </div>
      ) : (
        <p>{t.cropped}</p>
      )}
    </section>
  );
}
