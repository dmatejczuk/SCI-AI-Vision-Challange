import { useMemo, useState } from 'react';
import { pl } from '../../i18n/pl';
import type { SessionManager } from '../../services/SessionManager';
import type { InferenceSnapshot } from './types';
import { statistics, type PcaResult } from './labMath';
import { DataPlot, Heatmap } from './DataPlot';
const t = pl.explanation;
export function PcaPlot({ result }: { result: PcaResult }) {
  const [hover, setHover] = useState(0);
  const [zoom, setZoom] = useState(1);
  const xs = result.points.map((p) => p.x),
    ys = result.points.map((p) => p.y);
  const minX = Math.min(...xs, 0),
    maxX = Math.max(...xs, 0),
    minY = Math.min(...ys, 0),
    maxY = Math.max(...ys, 0);
  const scale = Math.min(470 / (maxX - minX || 1), 260 / (maxY - minY || 1)) * zoom;
  const x = (v: number) => 300 + (v - (minX + maxX) / 2) * scale;
  const y = (v: number) => 175 - (v - (minY + maxY) / 2) * scale;
  const point = result.points[hover];
  const label = (value: string) => (value === 'CURRENT' ? t.current : value);
  return (
    <figure className="pca-plot">
      <figcaption>{t.pca}</figcaption>
      <svg viewBox="0 0 600 350" role="img" aria-label={t.pca}>
        <line x1="55" x2="555" y1="305" y2="305" stroke="#61716c" />
        <line x1="55" x2="55" y1="35" y2="305" stroke="#61716c" />
        <text x="300" y="340" textAnchor="middle">
          {t.pcaAxes[0]} ({(result.explained[0] * 100).toFixed(1)}%)
        </text>
        <text x="12" y="175" transform="rotate(-90 12 175)" textAnchor="middle">
          {t.pcaAxes[1]} ({(result.explained[1] * 100).toFixed(1)}%)
        </text>
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <text x={65 + fraction * 470} y="322" textAnchor="middle">
              {((minX + maxX) / 2 + ((fraction - 0.5) * 470) / scale).toFixed(2)}
            </text>
            <text x="48" y={305 - fraction * 260} textAnchor="end">
              {((minY + maxY) / 2 + ((fraction - 0.5) * 260) / scale).toFixed(2)}
            </text>
          </g>
        ))}
        {result.points.map(
          (p, i) =>
            x(p.x) >= 55 &&
            x(p.x) <= 555 &&
            y(p.y) >= 35 &&
            y(p.y) <= 305 && (
              <circle
                key={i}
                cx={x(p.x)}
                cy={y(p.y)}
                r={p.label === 'CURRENT' ? 7 : 4}
                fill={p.label === 'OPEN' ? '#24754d' : p.label === 'FIST' ? '#306ea9' : '#b74335'}
                stroke={i === hover ? '#172f2c' : 'white'}
                tabIndex={0}
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
              >
                <title>
                  {label(p.label)} #{p.index}: {p.x.toFixed(5)}, {p.y.toFixed(5)}
                </title>
              </circle>
            ),
        )}
      </svg>
      <div className="plot-legend">
        <span style={{ color: '#24754d' }}>● OPEN</span>
        <span style={{ color: '#306ea9' }}>● FIST</span>
        <span style={{ color: '#b74335' }}>● {t.current}</span>
      </div>
      <output>
        {point &&
          `${label(point.label)} #${point.index}: ${point.x.toFixed(5)}, ${point.y.toFixed(5)}`}
      </output>
      <label>
        {t.zoom}
        <input
          type="range"
          min="1"
          max="4"
          step="0.1"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        />
      </label>
      <button onClick={() => setZoom(1)}>{t.resetZoom}</button>
      <p>{t.pcaHelp}</p>
      <p className="note">{t.pcaNote}</p>
    </figure>
  );
}
export function FeatureInspector({
  snapshot,
  detailed,
  session,
  busy,
}: {
  snapshot: InferenceSnapshot;
  detailed: boolean;
  session: SessionManager;
  busy: boolean;
}) {
  const [mode, setMode] = useState<'chart' | 'map'>('chart');
  const stats = useMemo(() => statistics(snapshot.featureVector), [snapshot.featureVector]);
  const means = snapshot.trainingMeans;
  return (
    <>
      <div className="feature-compression">
        <span>
          {snapshot.inputValues.length.toLocaleString('pl-PL')} {t.values}
          <small>{t.tensorValue}</small>
        </span>
        <b>→</b>
        <span>
          MobileNet v1 0.25<small>{t.extractor}</small>
        </span>
        <b>→</b>
        <span>
          {snapshot.featureVector.length} {t.values}
          <small>{t.features}</small>
        </span>
      </div>
      {detailed && (
        <div className="segmented">
          <button aria-pressed={mode === 'chart'} onClick={() => setMode('chart')}>
            {t.chart}
          </button>
          <button aria-pressed={mode === 'map'} onClick={() => setMode('map')}>
            {t.heatmap}
          </button>
        </div>
      )}
      {mode === 'map' && detailed ? (
        <>
          <Heatmap values={snapshot.featureVector} title={t.heatmap} />
          <p>{t.heatmapNote}</p>
        </>
      ) : (
        <DataPlot
          title={t.features}
          series={[{ label: t.current, values: snapshot.featureVector, color: '#24754d' }]}
          xLabel={t.featureIndex}
          yLabel={t.activation}
          zoom={detailed}
        />
      )}
      <p className="explanation-callout">{t.featureNote}</p>
      {detailed && (
        <>
          <details>
            <summary>{t.stats}</summary>
            <dl className="diagnostics">
              {Object.values(stats).map((value, i) => (
                <div className="stat-row" key={i}>
                  <dt>{t.statLabels[i]}</dt>
                  <dd>{value.toLocaleString('pl-PL', { maximumFractionDigits: 6 })}</dd>
                </div>
              ))}
            </dl>
          </details>
          {means && (
            <details>
              <summary>{t.means}</summary>
              <p>{t.meansNote}</p>
              <DataPlot
                title={t.means}
                series={[
                  { label: t.meanOpen, values: means.open, color: '#24754d' },
                  { label: t.meanFist, values: means.fist, color: '#306ea9' },
                  { label: t.current, values: snapshot.featureVector, color: '#916a18' },
                ]}
                xLabel={t.featureIndex}
                yLabel={t.activation}
              />
              <DataPlot
                title={t.difference}
                series={[{ label: t.difference, values: means.difference, color: '#b74335' }]}
                xLabel={t.featureIndex}
                yLabel={t.activation}
              />
            </details>
          )}
          <details>
            <summary>{t.pca}</summary>
            {snapshot.pca ? (
              <PcaPlot result={snapshot.pca} />
            ) : (
              <button disabled={busy} onClick={() => session.calculatePca()}>
                {t.calculatePca}
              </button>
            )}
          </details>
          <details>
            <summary>{t.inside}</summary>
            <p>{t.insideHelp}</p>
            {snapshot.activations ? (
              snapshot.activations.map((layer) => (
                <section key={layer.name}>
                  <h3>
                    {layer.name} · {layer.width} × {layer.height}
                  </h3>
                  <div className="activation-grid">
                    {layer.channels.map((channel) => (
                      <Heatmap
                        key={channel.index}
                        title={`${t.channel} ${channel.index} · ${t.mean}: ${channel.mean.toFixed(3)}`}
                        values={channel.values}
                        columns={layer.width}
                        spatial
                      />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <button disabled={busy} onClick={() => void session.inspectActivations()}>
                {busy ? t.busy : t.calculateActivations}
              </button>
            )}
          </details>
        </>
      )}
    </>
  );
}
