import { useEffect, useRef, useState } from 'react';
import type { SessionManager } from '../../services/SessionManager';
import type { InferenceSnapshot } from './types';
import { lab } from '../../i18n/lab';
import { pl } from '../../i18n/pl';
import { config } from '../../config/settings';
import { PcaPlot } from './FeatureInspector';
import { regionBounds } from './Occlusion';
import { clamp } from './labMath';
const t = pl.explanation;
export function WhySummary({ snapshot: s }: { snapshot: InferenceSnapshot }) {
  const g = s.gesturePreview,
    threshold = s.predictedClass === 'OPEN' ? g.openThreshold : g.fistThreshold;
  return (
    <section className="why-summary">
      <h3>
        {lab.final} {s.predictedClass}?
      </h3>
      <ol>
        <li>
          {s.sourceFrame.width} × {s.sourceFrame.height} px →{' '}
          {s.inputValues.length.toLocaleString('pl-PL')} {t.values} → {s.featureVector.length}{' '}
          {t.features}.
        </li>
        <li>
          Dense → softmax: OPEN {(s.classScores.open * 100).toFixed(2)}%, FIST{' '}
          {(s.classScores.fist * 100).toFixed(2)}%.{' '}
          {s.classScores.open === s.classScores.fist ? lab.tie : lab.higher}
        </li>
        <li>
          {t.threshold}: {(s.confidence * 100).toFixed(2)}% {s.confidence >= threshold ? '≥' : '<'}{' '}
          {(threshold * 100).toFixed(0)}%.{' '}
          {s.confidence >= threshold ? t.thresholdPassed : t.thresholdFailed}
        </li>
        <li>
          GestureController: {g.before} → {g.after}. {g.jump ? t.jumpEvent : t.noEvent}
        </li>
      </ol>
      <p className="note">{lab.preview}</p>
    </section>
  );
}
function OcclusionView({
  snapshot: s,
  session,
  busy,
  progress,
}: {
  snapshot: InferenceSnapshot;
  session: SessionManager;
  busy: boolean;
  progress: number;
}) {
  const [grid, setGrid] = useState(4),
    [point, setPoint] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const result = s.occlusion;
  useEffect(() => {
    if (!result || !canvas.current) return;
    const c = canvas.current,
      ctx = c.getContext('2d')!;
    c.width = s.sourceFrame.width;
    c.height = s.sourceFrame.height;
    ctx.putImageData(s.sourceFrame, 0, 0);
    const max = Math.max(...Array.from(result.deltas, Math.abs), 1e-9);
    result.deltas.forEach((delta, i) => {
      const r = regionBounds(s, result.grid, i);
      ctx.fillStyle =
        delta >= 0
          ? `rgba(195,53,37,${(0.75 * Math.abs(delta)) / max})`
          : `rgba(36,91,200,${(0.75 * Math.abs(delta)) / max})`;
      ctx.fillRect(r.x, r.y, r.width, r.height);
      ctx.strokeStyle = i === point ? 'white' : '#ffffff55';
      ctx.lineWidth = i === point ? 3 : 1;
      ctx.strokeRect(r.x, r.y, r.width, r.height);
    });
    return () => {
      c.width = 0;
      c.height = 0;
    };
  }, [s, result, point]);
  const select = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!result) return;
    const r = e.currentTarget.getBoundingClientRect(),
      crop = s.inputMetadata.crop;
    const x = ((e.clientX - r.left) / r.width) * s.sourceFrame.width,
      y = ((e.clientY - r.top) / r.height) * s.sourceFrame.height;
    if (x < crop.left || y < crop.top || x >= crop.left + crop.size || y >= crop.top + crop.size)
      return;
    setPoint(
      Math.floor(((y - crop.top) / crop.size) * result.grid) * result.grid +
        Math.floor(((x - crop.left) / crop.size) * result.grid),
    );
  };
  return (
    <details className="occlusion-experiment">
      <summary>{lab.perturb}</summary>
      <p>{lab.perturbHelp}</p>
      <label>
        {lab.grid}
        <select
          aria-label={lab.grid}
          disabled={busy}
          value={grid}
          onChange={(e) => setGrid(Number(e.target.value))}
        >
          <option value={4}>4 × 4 (16)</option>
          <option value={8}>8 × 8 (64)</option>
        </select>
      </label>
      <button
        disabled={busy}
        onClick={() => {
          setPoint(0);
          void session.inspectOcclusion(grid);
        }}
      >
        {lab.perturbRun}
      </button>
      {busy && (
        <div role="status">
          <progress aria-label={lab.perturb} value={progress} max={1} />
          <span>{Math.round(progress * 100)}%</span>
          <button onClick={() => session.cancelOcclusion()}>{lab.cancel}</button>
        </div>
      )}
      {result && (
        <>
          <figure className="occlusion-map">
            <canvas
              ref={canvas}
              role="img"
              tabIndex={0}
              aria-label={lab.perturb}
              onPointerMove={select}
              onPointerDown={select}
              onKeyDown={(e) => {
                if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                  e.preventDefault();
                  setPoint((v) =>
                    clamp(
                      v +
                        (e.key === 'ArrowRight'
                          ? 1
                          : e.key === 'ArrowLeft'
                            ? -1
                            : e.key === 'ArrowDown'
                              ? result.grid
                              : -result.grid),
                      0,
                      result.scores.length - 1,
                    ),
                  );
                }
              }}
            />
            <figcaption>
              {lab.perturbLegend} · {result.grid} × {result.grid}
            </figcaption>
          </figure>
          <output>
            {s.predictedClass} · #{point + 1} · {lab.baseline}: {(s.confidence * 100).toFixed(3)}% ·{' '}
            {lab.masked}: {(result.scores[point] * 100).toFixed(3)}% · {lab.change}:{' '}
            {(result.deltas[point] * 100).toFixed(3)}
          </output>
        </>
      )}
      <p className="note">{lab.perturbCaveat}</p>
      <details>
        <summary>{lab.technical}</summary>
        <p>{lab.occlusion}</p>
      </details>
    </details>
  );
}
export function WhyPanel({
  snapshot: s,
  session,
  busy,
  progress,
}: {
  snapshot: InferenceSnapshot;
  session: SessionManager;
  busy: boolean;
  progress: number;
}) {
  const [label, setLabel] = useState<'' | 'OPEN' | 'FIST'>('');
  const close = Math.abs(s.classScores.open - s.classScores.fist) < 0.2;
  const points = s.pca?.points.filter((p) => p.label !== 'CURRENT') ?? [];
  const means = (['OPEN', 'FIST'] as const).map((label) => {
    const rows = points.filter((p) => p.label === label);
    return rows.length ? rows.reduce((sum, p) => sum + (p.distance ?? 0), 0) / rows.length : null;
  });
  return (
    <section className="why-panel">
      <h2>
        {lab.why} {s.predictedClass}?
      </h2>
      {(close || !s.acceptedGesture) && <h3>{lab.uncertain}</h3>}
      <p>
        {close
          ? lab.closeScores
          : !s.acceptedGesture
            ? lab.belowThreshold
            : s.classScores.open === s.classScores.fist
              ? lab.tie
              : lab.higher}
      </p>
      <p className="explanation-callout">
        {t.source} → {s.featureVector.length} {t.features} → Dense → softmax → {s.predictedClass}
      </p>
      <details>
        <summary>{lab.technical}</summary>
        <p>{lab.mechanism}</p>
        <p>{lab.distributed}</p>
      </details>
      <h3>{lab.map}</h3>
      {s.pca ? (
        <>
          <PcaPlot result={s.pca} />
          <details>
            <summary>{lab.neighbors}</summary>
            <h4>{lab.distances}</h4>
            <dl className="diagnostics">
              {means.map((mean, i) => (
                <div key={i}>
                  <dt>{i ? 'FIST' : 'OPEN'}</dt>
                  <dd>{mean?.toFixed(5) ?? '–'}</dd>
                </div>
              ))}
            </dl>
            {means[0] !== null && means[1] !== null && (
              <p>
                {means[0] === means[1]
                  ? lab.equalDistances
                  : `${lab.closer} ${means[0] < means[1] ? 'OPEN' : 'FIST'}.`}
              </p>
            )}
            <ol>
              {[...points]
                .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
                .slice(0, 5)
                .map((p) => (
                  <li key={p.index}>
                    {p.label} #{p.sampleId} · {lab.distance}: {p.distance?.toFixed(5)} ·{' '}
                    {lab.cosine}: {p.cosine?.toFixed(5) ?? '–'}
                  </li>
                ))}
            </ol>
            <p>{lab.metricHelp}</p>
            <p className="note">{lab.distanceHelp}</p>
          </details>
        </>
      ) : (
        <button disabled={busy} onClick={() => session.calculatePca()}>
          {t.calculatePca}
        </button>
      )}
      <OcclusionView snapshot={s} session={session} busy={busy} progress={progress} />
      <details>
        <summary>{lab.trick}</summary>
        <p>{lab.trickHelp}</p>
        <button disabled={busy} onClick={() => session.challengeModel()}>
          {lab.trick}
        </button>
      </details>
      <details>
        <summary>{lab.add}</summary>
        <p>{lab.label}</p>
        <div className="segmented">
          {(['OPEN', 'FIST'] as const).map((v) => (
            <button disabled={busy} key={v} aria-pressed={label === v} onClick={() => setLabel(v)}>
              {v}
            </button>
          ))}
        </div>
        <p>{lab.addedHelp}</p>
        {label && session.dataset.counts[label] >= config.maximumSamples && <p>{lab.cap}</p>}
        <button
          disabled={busy || !label || session.dataset.counts[label] >= config.maximumSamples}
          onClick={() => label && void session.addFrozenExample(label)}
        >
          {lab.retrain}
        </button>
      </details>
    </section>
  );
}
