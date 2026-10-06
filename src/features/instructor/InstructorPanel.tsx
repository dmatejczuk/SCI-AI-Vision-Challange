import { SnapshotDiagnostics } from '../explanation/ExplanationView';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Modal } from '../../components/Modal';
import { pl } from '../../i18n/pl';
import type { SessionManager } from '../../services/SessionManager';
export function InstructorPanel({
  session,
  onClose,
}: {
  session: SessionManager;
  onClose: () => void;
}) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [confirm, setConfirm] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [diagnostics, setDiagnostics] = useState(() => session.diagnostics());
  useEffect(() => {
    const refresh = () => {
      navigator.mediaDevices
        ?.enumerateDevices()
        .then((list) => setDevices(list.filter((device) => device.kind === 'videoinput')))
        .catch(console.error);
    };
    refresh();
    navigator.mediaDevices?.addEventListener('devicechange', refresh);
    const timer = setInterval(() => setDiagnostics(session.diagnostics()), 750);
    return () => {
      clearInterval(timer);
      navigator.mediaDevices?.removeEventListener('devicechange', refresh);
    };
  }, [session]);
  const text = pl.instructor;
  return (
    <Modal title={text.title} onClose={onClose}>
      <p>{text.fallback}</p>
      <button
        disabled={state.busy}
        onClick={() => {
          void session.play(true);
          onClose();
        }}
      >
        {pl.testGame}
      </button>
      <dl className="diagnostics">
        <dt>{text.camera}</dt>
        <dd>{state.cameraLabel ? text.connected : text.disconnected}</dd>
        <dt>{text.device}</dt>
        <dd>{state.cameraLabel || '–'}</dd>
        <dt>OPEN / FIST</dt>
        <dd>
          {state.counts.OPEN} / {state.counts.FIST}
        </dd>
        <dt>{pl.prediction}</dt>
        <dd>
          {state.prediction.gesture ?? pl.uncertain} · {Math.round(state.prediction.open * 100)}% /{' '}
          {Math.round(state.prediction.fist * 100)}%
        </dd>
        <dt>{text.model}</dt>
        <dd>{state.trained ? pl.active : pl.empty}</dd>
        <dt>{text.controller}</dt>
        <dd>{diagnostics.controller}</dd>
        <dt>{text.latency}</dt>
        <dd>{state.prediction.latency.toFixed(0)} ms</dd>
        <dt>{text.inference}</dt>
        <dd>{state.prediction.fps.toFixed(1)}</dd>
        <dt>{text.gameFps}</dt>
        <dd>{diagnostics.fps.toFixed(0)}</dd>
        <dt>{text.tensors}</dt>
        <dd>{diagnostics.memory.numTensors}</dd>
        <dt>{text.memory}</dt>
        <dd>
          {(diagnostics.memory.numBytes / 1024 / 1024).toFixed(2)} MB
          {diagnostics.memory.unreliable ? ' ≈' : ''}
        </dd>
        <dt>{text.backend}</dt>
        <dd>{diagnostics.backend ?? '–'}</dd>
      </dl>
      <SnapshotDiagnostics session={session} />
      {(['fistThreshold', 'openThreshold', 'inferenceHz'] as const).map((key, index) => (
        <label className="setting" key={key}>
          {[text.threshold, text.rearm, text.frequency][index]}
          <input
            type="range"
            min={index === 2 ? 5 : 0.6}
            max={index === 2 ? 20 : 0.98}
            step={index === 2 ? 1 : 0.01}
            value={state.settings[key]}
            onChange={(event) =>
              session.configure({ ...state.settings, [key]: Number(event.target.value) })
            }
          />
          <output>{state.settings[key]}</output>
        </label>
      ))}
      <label className="setting">
        {text.chooseCamera}
        <select
          disabled={state.busy || !state.cameraLabel}
          value={session.camera.stream?.getVideoTracks()[0]?.getSettings().deviceId ?? ''}
          onChange={(event) => void session.restartCamera(event.target.value)}
        >
          <option value="">–</option>
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || pl.camera}
            </option>
          ))}
        </select>
      </label>
      <div className="actions">
        <button
          disabled={state.stage !== 'GAME' || state.paused}
          onClick={() => session.game.jump()}
        >
          {text.testJump}
        </button>
        <button
          disabled={state.busy || ['START', 'END', 'LOADING'].includes(state.stage)}
          onClick={() => void session.restartCamera()}
        >
          {text.restart}
        </button>
        <button className="danger" onClick={() => setConfirm(true)}>
          {text.reset}
        </button>
      </div>
      {state.detail && (
        <details>
          <summary>{text.diagnostic}</summary>
          <pre>{state.detail}</pre>
        </details>
      )}
      {confirm && (
        <Modal title={text.confirm} onClose={() => setConfirm(false)}>
          <p>{text.warning}</p>
          <div className="actions">
            <button onClick={() => setConfirm(false)}>{text.cancel}</button>
            <button
              className="danger"
              onClick={() => {
                void session.resetSession();
                onClose();
              }}
            >
              {text.reset}
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
