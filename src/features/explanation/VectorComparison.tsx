import { useMemo, useState } from 'react';
import { lab } from '../../i18n/lab';
import { pl } from '../../i18n/pl';
import type { InferenceSnapshot } from './types';
import { vectorMetrics, pixelDifference } from './labMath';
import { DataPlot } from './DataPlot';
import { Frame } from './PixelInspector';
export function VectorComparison({ a, b }: { a: InferenceSnapshot; b: InferenceSnapshot }) {
  const [mode, setMode] = useState(2);
  const metrics = useMemo(
    () => vectorMetrics(a.featureVector, b.featureVector),
    [a.featureVector, b.featureVector],
  );
  const difference = useMemo(
    () => a.featureVector.map((v, i) => Math.abs(v - b.featureVector[i])),
    [a.featureVector, b.featureVector],
  );
  const pixels = useMemo(
    () => pixelDifference(a.preparedFrame, b.preparedFrame),
    [a.preparedFrame, b.preparedFrame],
  );
  const series = [
    { label: 'A', values: a.featureVector, color: '#24754d' },
    { label: 'B', values: b.featureVector, color: '#306ea9' },
    { label: lab.difference, values: difference, color: '#b74335' },
  ];
  return (
    <section className="vector-comparison">
      <h3>{lab.vectors}</h3>
      <div className="comparison-panels">
        <Frame frame={a.sourceFrame} label={`A · ${a.predictedClass}`} />
        <Frame frame={b.sourceFrame} label={`B · ${b.predictedClass}`} />
      </div>
      <p>
        {lab.pixelDifference}: <strong>{pixels?.toFixed(4) ?? '—'}</strong>
      </p>
      <p>
        {lab.distance}: <strong>{metrics.distance.toFixed(5)}</strong> · {lab.cosine}:{' '}
        <strong>{metrics.cosine?.toFixed(5) ?? '—'}</strong>
      </p>
      <p className="note">{lab.scales}</p>
      <p>{lab.metricHelp}</p>
      <div className="segmented">
        {series.map((s, i) => (
          <button key={s.label} aria-pressed={mode === i} onClick={() => setMode(i)}>
            {s.label}
          </button>
        ))}
      </div>
      <DataPlot
        title={lab.vectors}
        series={[series[mode]]}
        tooltipSeries={series}
        xLabel={pl.explanation.featureIndex}
        yLabel={pl.explanation.activation}
      />
    </section>
  );
}
