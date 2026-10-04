import { WhyPanel, WhySummary } from './WhyPanel';
import { VectorComparison } from './VectorComparison';
import { lab } from '../../i18n/lab';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { pl } from '../../i18n/pl';
import type { SessionManager } from '../../services/SessionManager';
import type { ClassScores, ExplanationStep, InferenceSnapshot } from './types';
import { Frame, HistogramPlot, NormalizationInspector, PixelInspector } from './PixelInspector';
import { DataPlot } from './DataPlot';
import { FeatureInspector } from './FeatureInspector';
import { TensorInspector } from './TensorInspector';
import { SnapshotDiagnostics } from './SnapshotDiagnostics';
export { SnapshotDiagnostics } from './SnapshotDiagnostics';
const t = pl.explanation;
const basicSteps: ExplanationStep[] = [1, 2, 5, 6, 8];
const allSteps: ExplanationStep[] = [1, 2, 3, 4, 5, 6, 7, 8];
function Scores({ scores, snapshot }: { scores: ClassScores; snapshot?: InferenceSnapshot }) {
  return (
    <div className="probabilities">
      {(['open', 'fist'] as const).map((key) => {
        const threshold = snapshot
          ? snapshot.gesturePreview[key === 'open' ? 'openThreshold' : 'fistThreshold']
          : null;
        return (
          <div className="probability" key={key}>
            <div>
              <b>{key.toUpperCase()}</b>
              <strong>{(scores[key] * 100).toFixed(1)}%</strong>
            </div>
            <div className="threshold-track">
              <progress
                aria-label={`${key.toUpperCase()} — ${t.confidence}`}
                value={scores[key]}
                max={1}
              />
              {threshold !== null && (
                <i
                  style={{ left: `${threshold * 100}%` }}
                  title={`${t.threshold}: ${(threshold * 100).toFixed(0)}%`}
                />
              )}
            </div>
            <small>
              0% → 100%{threshold !== null && ` · ${t.threshold}: ${(threshold * 100).toFixed(0)}%`}{' '}
              · {t.raw}: {scores[key].toFixed(6)}
            </small>
          </div>
        );
      })}
    </div>
  );
}
function PredictionHistoryPlot({ snapshot }: { snapshot: InferenceSnapshot }) {
  const h = snapshot.history;
  return (
    <>
      <p>{t.historyHelp}</p>
      {h.length ? (
        <DataPlot
          title={t.history}
          xLabel={t.historyTime}
          yLabel={t.confidenceAxis}
          domain={[0, 100]}
          xValues={h.map((p) => (p.timestamp - snapshot.timestamp) / 1000)}
          series={[
            { label: 'OPEN', color: '#24754d', values: h.map((p) => p.open * 100) },
            { label: 'FIST', color: '#306ea9', values: h.map((p) => p.fist * 100) },
            {
              label: `${t.threshold} FIST`,
              color: '#916a18',
              values: h.map((p) => p.fistThreshold * 100),
            },
            {
              label: `${t.threshold} OPEN`,
              color: '#b74335',
              values: h.map((p) => p.openThreshold * 100),
            },
          ]}
          markers={h.flatMap((p, index) =>
            p.jump
              ? [{ index, label: `OPEN → FIST · ${p.sentToGame ? 'JUMP' : t.jumpEvent}` }]
              : [],
          )}
        />
      ) : (
        <p>{t.noHistory}</p>
      )}
      <ul className="history-events">
        {h
          .filter((p) => p.jump)
          .map((p) => (
            <li key={p.timestamp}>
              {((p.timestamp - snapshot.timestamp) / 1000).toFixed(2)} s · OPEN → FIST ·{' '}
              {p.sentToGame ? 'JUMP' : t.jumpEvent}
            </li>
          ))}
      </ul>
    </>
  );
}
function ControllerDecision({ snapshot }: { snapshot: InferenceSnapshot }) {
  const g = snapshot.gesturePreview;
  const threshold = snapshot.predictedClass === 'OPEN' ? g.openThreshold : g.fistThreshold;
  return (
    <>
      <div className="explanation-result">{snapshot.predictedClass}</div>
      <p className="threshold-equation">
        {(snapshot.confidence * 100).toFixed(2)}% {snapshot.confidence >= threshold ? '≥' : '<'}{' '}
        {(threshold * 100).toFixed(0)}%
      </p>
      <p>{snapshot.confidence >= threshold ? t.thresholdPassed : t.thresholdFailed}</p>
      <p>
        {t.accepted}: <b>{snapshot.acceptedGesture ?? t.uncertain}</b>
      </p>
      <dl className="diagnostics">
        <dt>{t.before}</dt>
        <dd>{g.before === 'ARMED' ? t.armedState : t.waiting}</dd>
        <dt>{t.after}</dt>
        <dd>{g.after === 'ARMED' ? t.armedState : t.waiting}</dd>
        <dt>{t.candidate}</dt>
        <dd>
          {g.candidateBefore ?? '—'} / {g.countBefore} → {g.candidateAfter ?? '—'} / {g.countAfter}
        </dd>
        <dt>{t.stable}</dt>
        <dd>{g.stableFrames}</dd>
      </dl>
      <p className="note">{t.rule}</p>
    </>
  );
}
function SnapshotComparison({
  current,
  previous,
}: {
  current: InferenceSnapshot;
  previous: InferenceSnapshot;
}) {
  return (
    <details className="snapshot-comparison" open>
      <summary>{t.changed}</summary>
      <p>{t.compare}</p>
      <div className="comparison-panels">
        {[previous, current].map((s, i) => (
          <section key={i}>
            <h3>
              {i ? t.current : t.previous} · {s.predictedClass}
            </h3>
            <p>
              {t.revision} {s.modelRevision}
            </p>
            <Frame frame={s.sourceFrame} label={i ? t.current : t.previous} />
            <HistogramPlot snapshot={s} />
            <DataPlot
              title={t.features}
              series={[
                {
                  label: s.predictedClass,
                  values: s.featureVector,
                  color: i ? '#306ea9' : '#24754d',
                },
              ]}
              xLabel={t.featureIndex}
              yLabel={t.activation}
            />
            <Scores scores={s.classScores} />
          </section>
        ))}
      </div>
      <p className="note">{t.comparePrivacy}</p>
    </details>
  );
}
function Laboratory({
  session,
  snapshot,
}: {
  session: SessionManager;
  snapshot: InferenceSnapshot;
}) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const { step, detailed, comparison, previous } = state.explanation;
  const [selected, setSelected] = useState({
    x: Math.floor(snapshot.sourceFrame.width / 2),
    y: Math.floor(snapshot.sourceFrame.height / 2),
  });
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const steps = detailed ? allSteps : basicSteps;
  const before = [...steps].reverse().find((s) => s < step),
    after = steps.find((s) => s > step);
  const m = snapshot.inputMetadata;
  const navigate = (s: ExplanationStep) => session.explanationStep(s);
  return (
    <section className="lab-shell">
      <div className="lab-heading">
        <div>
          <div className="eyebrow">
            {t.title} · {step} / {allSteps.length}
          </div>
          <h1 ref={heading} tabIndex={-1}>
            {t.titles[step - 1]}
          </h1>
        </div>
        <div>
          <span className="mode-label">{detailed ? t.detailed : t.basic}</span>
          <button disabled={state.busy} onClick={() => session.setDetailed(!detailed)}>
            {detailed ? t.less : t.more}
          </button>
        </div>
      </div>
      <nav className="lab-pipeline" aria-label={t.pipeline}>
        {allSteps.map((s) => (
          <button
            key={s}
            disabled={state.busy || (!detailed && !basicSteps.includes(s))}
            aria-current={s === step ? 'step' : undefined}
            onClick={() => navigate(s)}
          >
            <small>{s.toString().padStart(2, '0')}</small>
            {t.steps[s - 1]}
          </button>
        ))}
      </nav>
      <p className="lab-description">{t.descriptions[step - 1]}</p>
      {state.error && (
        <div className="error" role="alert">
          <p>{pl.errors[state.error]}</p>
          <button disabled={state.busy} onClick={() => void session.retry()}>
            {pl.retry}
          </button>
        </div>
      )}
      <div className="lab-stage">
        <section className="explanation-visual">
          {step === 1 && (
            <>
              <Frame frame={snapshot.sourceFrame} label={t.source} />
              <p className="lab-big-number">
                {snapshot.sourceFrame.width} × {snapshot.sourceFrame.height} ={' '}
                <strong>
                  {(snapshot.sourceFrame.width * snapshot.sourceFrame.height).toLocaleString(
                    'pl-PL',
                  )}{' '}
                  {t.pixels}
                </strong>
              </p>
              <button className="primary" onClick={() => navigate(2)}>
                {t.seePixels} →
              </button>
            </>
          )}
          {step === 2 && (
            <PixelInspector
              snapshot={snapshot}
              selected={selected}
              onSelect={setSelected}
              detailed={detailed}
            />
          )}
          {step === 3 && (
            <>
              <div className="prepared-pair">
                <Frame
                  frame={snapshot.sourceFrame}
                  label={t.source}
                  selected={selected}
                  onSelect={setSelected}
                />
                <span>→</span>
                <Frame frame={snapshot.preparedFrame} label={t.prepared} />
              </div>
              <p>
                {t.crop}: ({m.crop.left}, {m.crop.top}) · {m.crop.size} × {m.crop.size} → {m.width}{' '}
                × {m.height}
              </p>
              <p>
                {t.resize} · {t.mirror}
              </p>
              <NormalizationInspector snapshot={snapshot} selected={selected} />
            </>
          )}
          {step === 4 && <TensorInspector snapshot={snapshot} />}
          {step === 5 && (
            <FeatureInspector
              snapshot={snapshot}
              detailed={detailed}
              session={session}
              busy={state.busy}
            />
          )}
          {step === 6 && (
            <>
              <p>
                {t.features}: {snapshot.featureVector.length} {t.values} → Dense → softmax
              </p>
              <Scores scores={snapshot.classScores} snapshot={snapshot} />
              <p>{t.scoreNote}</p>
              {detailed && (
                <WhyPanel
                  snapshot={snapshot}
                  session={session}
                  busy={state.busy}
                  progress={state.progress}
                />
              )}
              <p>
                {t.examples}: OPEN — {snapshot.samples.OPEN} / FIST — {snapshot.samples.FIST}
              </p>
              {detailed && (
                <>
                  <details>
                    <summary>{t.classifierInput}</summary>
                    <DataPlot
                      title={t.classifierInput}
                      series={[
                        { label: t.current, values: snapshot.featureVector, color: '#24754d' },
                      ]}
                      xLabel={t.featureIndex}
                      yLabel={t.activation}
                    />
                  </details>
                  <details>
                    <summary>{t.history}</summary>
                    <PredictionHistoryPlot snapshot={snapshot} />
                  </details>
                </>
              )}
            </>
          )}
          {step === 7 && <ControllerDecision snapshot={snapshot} />}
          {step === 8 && (
            <>
              <div className="action-domains">
                <section>
                  <h3>{t.ml}</h3>
                  <ol>
                    {[
                      `${t.source} → ${t.pixels}`,
                      `${t.steps[2]} → ${t.steps[3]}`,
                      `${snapshot.featureVector.length} ${t.features}`,
                      'Dense → softmax',
                      `${snapshot.predictedClass} ${(snapshot.confidence * 100).toFixed(1)}%`,
                    ].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                </section>
                <section>
                  <h3>{t.code}</h3>
                  <ol>
                    <li>
                      {snapshot.acceptedGesture
                        ? `${t.thresholdPassed}: ${snapshot.acceptedGesture}`
                        : t.uncertain}
                    </li>
                    <li>{snapshot.gesturePreview.before === 'ARMED' ? t.armedState : t.waiting}</li>
                    <li>
                      {t.stable}: {snapshot.gesturePreview.stableFrames}
                    </li>
                    <li>{snapshot.gesturePreview.jump ? 'OPEN → FIST → JUMP' : t.noEvent}</li>
                  </ol>
                </section>
              </div>
              <div className="rule-preview">
                <strong>{snapshot.gesturePreview.jump ? t.jumpEvent : t.noEvent}</strong>
                {snapshot.gesturePreview.jump ? (
                  <div className="preview-ground">
                    <span className="preview-runner" />
                  </div>
                ) : (
                  <p>{t.noJump}</p>
                )}
                <p>{t.actionHelp}</p>
              </div>
              <WhySummary snapshot={snapshot} />
              <p className="explanation-callout">{t.descriptions[7]}</p>
            </>
          )}
        </section>
        <aside className="explanation-copy">
          <h2>{t.title}</h2>
          <p>{detailed ? t.privacy : t.basicHelp}</p>
          <div className="snapshot-badge">
            #{snapshot.id} · {t.revision} {snapshot.modelRevision}
            <small>{new Date(snapshot.timestamp).toLocaleTimeString('pl-PL')}</small>
          </div>
          <p>
            {t.confidence}:{' '}
            <b>
              {snapshot.predictedClass} {(snapshot.confidence * 100).toFixed(1)}%
            </b>
          </p>
          {step === 8 && (
            <>
              <button className="primary" disabled={state.busy} onClick={() => void session.play()}>
                {pl.play} →
              </button>
              <button className="secondary" onClick={() => session.anotherFrame(false, true)}>
                {t.compareGesture}
              </button>
              <button className="quiet" onClick={() => session.anotherFrame()}>
                {t.again}
              </button>
              <details className="experiment">
                <summary>{t.partner}</summary>
                <p>{t.partnerHelp}</p>
                <button onClick={() => session.anotherFrame(true, true)}>{t.partner}</button>
                <p>{t.improveHelp}</p>
                <button onClick={() => session.improve()}>{t.improve}</button>
              </details>
              <p className="note">{t.lesson}</p>
            </>
          )}
          {detailed && (
            <details>
              <summary>{t.diagnostics}</summary>
              <SnapshotDiagnostics session={session} />
            </details>
          )}
        </aside>
      </div>
      {step === 5 && detailed && comparison && <VectorComparison a={comparison} b={snapshot} />}
      {step === 8 && comparison && <SnapshotComparison current={snapshot} previous={comparison} />}
      {step === 8 && !comparison && previous && (
        <div className="comparison">
          <section>
            <h3>{t.previous}</h3>
            <small>
              {t.revision} {previous.modelRevision}
            </small>
            <Scores scores={previous.classScores} />
          </section>
          <section>
            <h3>{t.current}</h3>
            <small>
              {t.revision} {snapshot.modelRevision}
            </small>
            <Scores scores={snapshot.classScores} />
          </section>
        </div>
      )}
      <div className="explanation-navigation">
        <button disabled={!before || state.busy} onClick={() => before && navigate(before)}>
          {t.back}
        </button>
        <progress
          aria-label={t.title}
          value={steps.filter((s) => s <= step).length}
          max={steps.length}
        />
        <button disabled={!after || state.busy} onClick={() => after && navigate(after)}>
          {t.next}
        </button>
      </div>
      <button className="quiet" disabled={state.busy} onClick={() => session.test()}>
        {t.return}
      </button>
    </section>
  );
}
export function ExplanationView({ session }: { session: SessionManager }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const { snapshot, partnerExperiment, comparison, challenge } = state.explanation;
  if (snapshot) return <Laboratory key={snapshot.id} session={session} snapshot={snapshot} />;
  return (
    <section className="explanation-copy">
      <div className="eyebrow">{t.entry}</div>
      <h1>{challenge ? lab.trick : t.welcome}</h1>
      <p className="lead">{t.labIntro}</p>
      <p>
        {challenge
          ? lab.trickHelp
          : partnerExperiment
            ? t.partnerHelp
            : comparison
              ? lab.compareHelp
              : t.instruction}
      </p>
      <button
        className="primary"
        disabled={state.busy || !!state.error}
        onClick={() => void session.freezeExplanation()}
      >
        {state.busy ? t.busy : t.freeze}
      </button>
      {state.error && (
        <div className="error" role="alert">
          <p>{pl.errors[state.error]}</p>
          <button disabled={state.busy} onClick={() => void session.retry()}>
            {pl.retry}
          </button>
        </div>
      )}
      <p className="note">{t.comparePrivacy}</p>
      <button className="quiet" disabled={state.busy} onClick={() => session.test()}>
        {t.return}
      </button>
    </section>
  );
}
