import { useEffect, useRef, useState } from 'react';
import { pl } from '../../i18n/pl';
import type { InferenceSnapshot } from './types';
import { clamp, pixelAt, sourceToInput, tensorPixel } from './labMath';
import { DataPlot } from './DataPlot';
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
}: {
  frame: ImageData;
  label: string;
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
    if (selected) {
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
  }, [frame, selected]);
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
        onPointerMove={choose}
        onPointerDown={choose}
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
  const [channel, setChannel] = useState(-1);
  const [anchor, setAnchor] = useState(selected);
  const rgb = pixelAt(snapshot.sourceFrame, selected.x, selected.y);
  const frame = snapshot.sourceFrame;
  const left = clamp(anchor.x - 4, 0, Math.max(0, frame.width - 8)),
    top = clamp(anchor.y - 4, 0, Math.max(0, frame.height - 8));
  return (
    <>
      <div className="pixel-layout">
        <Frame
          frame={frame}
          label={t.source}
          selected={selected}
          onSelect={
            detailed
              ? (p) => {
                  onSelect(p);
                  setAnchor(p);
                }
              : undefined
          }
        />
        <div>
          <h3>{t.patch}</h3>
          {detailed && (
            <div className="segmented">
              {[t.color, 'R', 'G', 'B'].map((label, i) => (
                <button
                  key={label}
                  aria-pressed={channel === i - 1}
                  onClick={() => setChannel(i - 1)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="pixel-grid">
            {Array.from({ length: Math.min(8, frame.height) }, (_, row) =>
              Array.from({ length: Math.min(8, frame.width) }, (_, col) => {
                const x = left + col,
                  y = top + row,
                  values = pixelAt(frame, x, y);
                const colors =
                  channel < 0
                    ? values
                    : [0, 1, 2].map((i) => (i === channel ? values[channel] : 0));
                return (
                  <button
                    key={`${x},${y}`}
                    className={selected.x === x && selected.y === y ? 'selected-pixel' : ''}
                    style={{
                      background: `rgb(${colors.join(',')})`,
                      color: colors.reduce((sum, v) => sum + v, 0) > 420 ? '#172f2c' : '#fff',
                    }}
                    aria-label={`${t.pixel} (${x}, ${y}) RGB(${values.join(', ')})`}
                    disabled={!detailed}
                    onPointerEnter={() => detailed && onSelect({ x, y })}
                    onClick={() => onSelect({ x, y })}
                  >
                    {channel >= 0 ? values[channel] : ''}
                  </button>
                );
              }),
            )}
          </div>
          <output className="pixel-readout">
            <i style={{ background: `rgb(${rgb.join(',')})` }} />
            {t.pixel} (x: {selected.x}, y: {selected.y})<strong>RGB({rgb.join(', ')})</strong>
          </output>
          {rgb.map((value, c) => (
            <label className="channel-bar" key={c}>
              <span>
                {'RGB'[c]} — {value} / 255
              </span>
              <meter min={0} max={255} value={value} style={{ accentColor: channelColors[c] }} />
              <small>0 — 255</small>
            </label>
          ))}
        </div>
      </div>
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
