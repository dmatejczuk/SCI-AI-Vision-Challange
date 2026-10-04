import { useSyncExternalStore } from 'react';
import { pl } from '../../i18n/pl';
import type { SessionManager } from '../../services/SessionManager';
const text = pl.explanation;
export function SnapshotDiagnostics({ session }: { session: SessionManager }) {
  const { explanation } = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const snapshot = explanation.snapshot;
  return (
    <section>
      <h3>{text.diagnostics}</h3>
      <dl className="diagnostics">
        <dt>{text.analyses}</dt>
        <dd>{explanation.analysisCount}</dd>
        {snapshot && (
          <>
            <dt>{text.input}</dt>
            <dd>
              {snapshot.inputMetadata.sourceWidth} × {snapshot.inputMetadata.sourceHeight} →{' '}
              {snapshot.inputMetadata.width} × {snapshot.inputMetadata.height}
            </dd>
            <dt>{text.shape}</dt>
            <dd>[{snapshot.inputMetadata.shape.join(', ')}]</dd>
            <dt>{text.normalization}</dt>
            <dd>
              x / {snapshot.inputMetadata.normalization.divisor} + (
              {snapshot.inputMetadata.normalization.offset})
            </dd>
            <dt>{text.tensorValue}</dt>
            <dd>{snapshot.inputValues.length.toLocaleString('pl-PL')}</dd>
            <dt>{text.vector}</dt>
            <dd>{snapshot.featureVector.length}</dd>
            <dt>{text.raw}</dt>
            <dd>
              {snapshot.classScores.open.toFixed(6)} / {snapshot.classScores.fist.toFixed(6)}
            </dd>
            <dt>{text.selected}</dt>
            <dd>
              {snapshot.predictedClass} · {(snapshot.confidence * 100).toFixed(2)}%
            </dd>
            <dt>{text.times}</dt>
            <dd>
              {[
                snapshot.timings.preprocessing,
                snapshot.timings.extraction,
                snapshot.timings.classification,
                snapshot.timings.total,
              ]
                .map((value) => value.toFixed(1))
                .join(' / ')}{' '}
              ms
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}
