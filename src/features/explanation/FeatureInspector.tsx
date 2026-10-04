import { useMemo, useState } from 'react';
import { pl } from '../../i18n/pl';
import type { SessionManager } from '../../services/SessionManager';
import type { InferenceSnapshot } from './types';
import { statistics, type PcaResult } from './labMath';
import { DataPlot, Heatmap } from './DataPlot';
import { lab } from '../../i18n/lab';
const t = pl.explanation;
export function PcaPlot({ result }: { result: PcaResult }) {
  const [hover, setHover] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [filter, setFilter] = useState('ALL');
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
  const label = (value: string) => (value === 'CURRENT' ? lab.yourImage : value);
  return (
    <figure className="pca-plot">
      <figcaption>{t.pca}</figcaption>
      <div className="segmented">
        {[
          ['ALL', lab.all],
          ['OPEN', lab.onlyOpen],
          ['FIST', lab.onlyFist],
        ].map(([v, l]) => (
          <button
            key={v}
            aria-pressed={filter === v}
            onClick={() => {
              setFilter(v);
              setHover(result.points.findIndex((p) => p.label === 'CURRENT'));
            }}
          >
            {l}
          </button>
        ))}
      </div>
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
            (filter === 'ALL' || p.label === filter || p.label === 'CURRENT') &&
            x(p.x) >= 55 &&
            x(p.x) <= 555 &&
            y(p.y) >= 35 &&
            y(p.y) <= 305 && (
              <circle
                key={i}
                cx={x(p.x)}
                cy={y(p.y)}
                r={p.label === 'CURRENT' ? 11 : 4}
                fill={p.label === 'OPEN' ? '#24754d' : p.label === 'FIST' ? '#306ea9' : '#b74335'}
                stroke={i === hover ? '#172f2c' : 'white'}
                tabIndex={0}
                onClick={() => setHover(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setHover(i);
                }}
                onPointerEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
              >
                <title>
                  {label(p.label)} #{p.sampleId ?? p.index}: {p.x.toFixed(5)}, {p.y.toFixed(5)}
                </title>
              </circle>
            ),
        )}
        {result.points
          .filter(
            (p) =>
              p.label === 'CURRENT' &&
              x(p.x) >= 55 &&
              x(p.x) <= 555 &&
              y(p.y) >= 35 &&
              y(p.y) <= 305,
          )
          .map((p) => (
            <text
              key="current-label"
              x={Math.max(100, Math.min(480, x(p.x)))}
              y={Math.max(20, Math.min(290, y(p.y) - 18))}
              textAnchor="middle"
              fill="#b74335"
              fontWeight="bold"
            >
              {lab.yourImage}
            </text>
          ))}
      </svg>
      <div className="plot-legend">
        <span style={{ color: '#24754d' }}>● OPEN</span>
        <span style={{ color: '#306ea9' }}>● FIST</span>
        <span style={{ color: '#b74335' }}>● {lab.yourImage}</span>
      </div>
      <output>
        {point &&
          `${label(point.label)} ${point.sampleId ? `#${point.sampleId}` : ''} · PCA: ${point.x.toFixed(5)}, ${point.y.toFixed(5)}${point.distance !== undefined ? ` · ${lab.distance}: ${point.distance.toFixed(5)} · ${lab.cosine}: ${point.cosine?.toFixed(5) ?? '—'}` : ''}`}
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
      <h3>{lab.whatFeatures}</h3>
      <p>{lab.featureIntro}</p>
      <div className="feature-compression numeric-flow">
        <span>
          {snapshot.inputValues.length.toLocaleString('pl-PL')} {t.values}
          <small>{t.tensorValue}</small>
          <code>
            {Array.from(snapshot.inputValues.slice(0, 24))
              .map((v) => v.toFixed(2))
              .join(' ')}
          </code>
        </span>
        <b>→</b>
        <span>
          MobileNet v1 0.25<small>{t.extractor}</small>
        </span>
        <b>→</b>
        <span>
          {snapshot.featureVector.length} {t.values}
          <small>{t.features}</small>
          <code>
            {Array.from(snapshot.featureVector.slice(0, 6))
              .map((v) => v.toFixed(3))
              .join(' · ')}
          </code>
        </span>
      </div>
      <small>{lab.excerpt}</small>
      <div className="explanation-callout">
        <h3>{lab.finger}</h3>
        <p>{lab.distributed}</p>
      </div>
      <details>
        <summary>{lab.deeper}</summary>
        <p>{lab.featureDeeper}</p>
      </details>
      {detailed && (
        <section>
          <p>{lab.compareHelp}</p>
          <button disabled={busy} onClick={() => session.anotherFrame(false, true)}>
            {lab.compare}
          </button>
        </section>
      )}
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
