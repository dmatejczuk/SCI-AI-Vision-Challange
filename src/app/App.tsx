import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { SessionManager } from '../services/SessionManager';
import { pl } from '../i18n/pl';
import { config } from '../config/settings';
import { HandSymbol } from '../components/HandSymbol';
import { GameView } from '../features/game/GameView';
import { InstructorPanel } from '../features/instructor/InstructorPanel';
const session = new SessionManager();
export function App() {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const video = useRef<HTMLVideoElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [instructor, setInstructor] = useState(false);
  const { stage, counts, prediction, busy } = state;
  useEffect(() => {
    session.attachVideo(video.current!);
    const keyboard = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyD') {
        event.preventDefault();
        setInstructor((value) => !value);
      }
    };
    const visibility = () => {
      if (document.hidden && session.getSnapshot().stage === 'GAME') session.pause();
      else if (document.hidden) session.gestures.reset();
    };
    const unload = () => {
      void session.resetSession();
    };
    window.addEventListener('keydown', keyboard);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', unload);
    return () => {
      window.removeEventListener('keydown', keyboard);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', unload);
    };
  }, []);
  useEffect(() => {
    heading.current?.focus();
  }, [stage]);
  const isCapture = stage === 'OPEN' || stage === 'FIST';
  const showCamera = isCapture || stage === 'TEST' || stage === 'GAME';
  const step = ['START', 'LOADING', 'OPEN', 'FIST'].includes(stage)
    ? 0
    : ['READY', 'TRAINING', 'TRAINED'].includes(stage)
      ? 1
      : ['TEST', 'PARTNER'].includes(stage)
        ? 2
        : 3;
  const title =
    stage === 'START'
      ? pl.startTitle
      : stage === 'LOADING'
        ? pl.loading
        : stage === 'OPEN'
          ? pl.openTitle
          : stage === 'FIST'
            ? pl.fistTitle
            : stage === 'READY'
              ? pl.ready
              : stage === 'TRAINING'
                ? pl.training
                : stage === 'TRAINED'
                  ? pl.trained
                  : stage === 'TEST'
                    ? state.partner
                      ? pl.partnerTest
                      : pl.test
                    : stage === 'GAME'
                      ? pl.gameTitle
                      : stage === 'RESULT'
                        ? pl.gameOver
                        : stage === 'PARTNER'
                          ? pl.swap
                          : pl.end;
  const probabilities = (
    <div className="probabilities">
      <div className="prediction-heading">
        <span>{pl.prediction}</span>
        <strong>{prediction.gesture ?? pl.uncertain}</strong>
      </div>
      {(['OPEN', 'FIST'] as const).map((label, index) => (
        <div className="probability" key={label}>
          <div>
            <span>{label}</span>
            <b>{Math.round((index ? prediction.fist : prediction.open) * 100)}%</b>
          </div>
          <progress
            aria-label={`${label} — ${pl.probability}`}
            value={index ? prediction.fist : prediction.open}
            max={1}
          />
        </div>
      ))}
    </div>
  );
  return (
    <div className="app-shell">
      <header>
        <a className="brand" href="#" onClick={(event) => event.preventDefault()}>
          <span className="brand-mark">
            SCI<span>_</span>
          </span>
          <span>
            {pl.brand}
            <small>{pl.school}</small>
          </span>
        </a>
        <div className="workshop-tag">{pl.workshop}</div>
      </header>
      <nav aria-label={pl.workshop}>
        <ol className="steps">
          {pl.steps.map((label, index) => (
            <li
              key={label}
              className={index === step ? 'current' : index < step ? 'complete' : ''}
              aria-current={index === step ? 'step' : undefined}
            >
              <span>{index < step ? '✓' : `0${index + 1}`}</span>
              {label}
            </li>
          ))}
        </ol>
      </nav>
      <main
        className={`${stage === 'GAME' ? 'playing' : ''} ${stage === 'START' ? 'welcome' : ''}`}
      >
        <section
          className={`visual-panel ${showCamera ? 'camera-visible' : ''}`}
          aria-label={pl.camera}
        >
          <div className={`camera-frame ${stage === 'GAME' ? 'compact' : ''}`} hidden={!showCamera}>
            <video ref={video} autoPlay muted playsInline aria-label={pl.camera} />
            <div className="camera-corners" />
            <span className="live-label">{state.cameraLabel ? '● ' + pl.live : pl.empty}</span>
            <span className="frame-label">{pl.frame}</span>
          </div>
          {!showCamera && (
            <div className="illustration">
              {stage === 'START' || stage === 'LOADING' ? (
                <>
                  <div className="visual-topline">
                    <span>{pl.inputLabel}</span>
                    <span>{pl.labLabel}</span>
                  </div>
                  <div className="hand-pair">
                    <div>
                      <HandSymbol />
                      <span>OPEN</span>
                    </div>
                    <span className="arrow">→</span>
                    <div>
                      <HandSymbol fist />
                      <span>FIST</span>
                    </div>
                  </div>
                  <div className="signal-line">
                    <span />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <span />
                  </div>
                  <div className="visual-bottomline">
                    <span>{pl.startSequence}</span>
                    <span>↗</span>
                  </div>
                </>
              ) : stage === 'RESULT' ? (
                <div className="score-art">
                  <span>{pl.score}</span>
                  <strong>{state.score.toString().padStart(3, '0')}</strong>
                  <span>SCI / RUN</span>
                </div>
              ) : stage === 'PARTNER' || stage === 'END' ? (
                <>
                  <div className="swap-art">{stage === 'PARTNER' ? '01 ⇄ 02' : pl.dataToAi}</div>
                  <p>{stage === 'PARTNER' ? pl.swapHelp : pl.endQuestion}</p>
                </>
              ) : (
                <div className="dataset-art">
                  <span>{pl.model}</span>
                  <div>
                    <b>{counts.OPEN}</b>
                    <span>OPEN</span>
                  </div>
                  <div>
                    <b>{counts.FIST}</b>
                    <span>FIST</span>
                  </div>
                  <div className="dataset-status">{state.trained ? '✓' : '→'}</div>
                </div>
              )}
            </div>
          )}
          {showCamera && stage !== 'GAME' && (
            <div className="camera-caption">
              <span>{pl.camera}</span>
              <span>640 × 480 · {pl.local}</span>
            </div>
          )}
          {(stage === 'TEST' || stage === 'GAME') && probabilities}
          {stage === 'GAME' && (
            <p className="controller-state">
              {state.controlMode === 'KEYBOARD'
                ? pl.keyboardTest
                : state.armed
                  ? '● ' + pl.armed
                  : '○ ' + pl.rearm}
            </p>
          )}
        </section>
        <section className="task-panel">
          <div className="eyebrow">
            {stage === 'START'
              ? pl.workshop
              : `${String(step + 1).padStart(2, '0')} / ${pl.steps[step]}`}
          </div>
          <h1 ref={heading} tabIndex={-1}>
            {title}
          </h1>
          {state.error ? (
            <div className="error" role="alert">
              <p>{pl.errors[state.error]}</p>
              <button disabled={busy} onClick={() => void session.retry()}>
                {pl.retry}
              </button>
            </div>
          ) : (
            <>
              {stage === 'START' && (
                <>
                  <p className="lead">{pl.subtitle}</p>
                  <p>{pl.intro}</p>
                  <button
                    className="primary"
                    disabled={state.resetting}
                    onClick={() => void session.start()}
                  >
                    {state.resetting ? pl.instructor.resetting : pl.start}
                    <span>→</span>
                  </button>
                </>
              )}
              {stage === 'LOADING' && (
                <>
                  <p>{pl.loadingHelp}</p>
                  <progress aria-label={pl.loading} />
                </>
              )}
              {isCapture && (
                <>
                  <p className="lead">{pl.captureHelp}</p>
                  {state.trained && <p className="note">{pl.addHelp}</p>}
                  <div className="sample-counts">
                    <span className={stage === 'OPEN' ? 'selected' : ''}>
                      OPEN <b>{counts.OPEN}</b>
                    </span>
                    <span className={stage === 'FIST' ? 'selected' : ''}>
                      FIST <b>{counts.FIST}</b>
                    </span>
                  </div>
                  <progress aria-label={pl.collecting} max={1} value={state.progress} />
                  <button
                    className="primary"
                    disabled={busy || counts[stage] >= config.maximumSamples}
                    onClick={() => void session.capture(stage)}
                  >
                    {busy ? pl.collecting : stage === 'OPEN' ? pl.captureOpen : pl.captureFist}
                    <span>+</span>
                  </button>
                  {counts[stage] >= config.maximumSamples && <p>{pl.limit}</p>}
                  <button
                    className="secondary"
                    disabled={busy || counts[stage] < config.minimumSamples}
                    onClick={() => session.next()}
                  >
                    {stage === 'OPEN' ? pl.nextFist : pl.nextTrain}
                    <span>→</span>
                  </button>
                </>
              )}
              {stage === 'READY' && (
                <>
                  <p className="lead">{pl.readyHelp}</p>
                  <button className="primary" onClick={() => void session.train()}>
                    {state.trained ? pl.retrain : pl.train}
                    <span>→</span>
                  </button>
                </>
              )}
              {stage === 'TRAINING' && (
                <>
                  <p>{pl.trainingHelp}</p>
                  <progress aria-label={pl.training} value={state.progress} max={1} />
                  <div className="progress-number" aria-live="polite">
                    {Math.round(state.progress * 100)}%
                  </div>
                </>
              )}
              {stage === 'TRAINED' && (
                <>
                  <p className="lead">{pl.trainedHelp}</p>
                  <button className="primary" onClick={() => session.test()}>
                    {pl.check}
                    <span>→</span>
                  </button>
                </>
              )}
              {stage === 'TEST' && (
                <>
                  <p className="lead">{pl.testHelp}</p>
                  {state.partner && <p>{pl.partnerHelp}</p>}
                  <button className="primary" onClick={() => void session.play()}>
                    {pl.play}
                    <span>→</span>
                  </button>
                  <button className="secondary" onClick={() => session.improve()}>
                    {pl.add}
                  </button>
                  <p className="note">{pl.confidenceNote}</p>
                </>
              )}
              {stage === 'RESULT' && state.controlMode === 'KEYBOARD' && (
                <>
                  <p>{pl.keyboardTest}</p>
                  <button className="primary" onClick={() => void session.play(true)}>
                    {pl.retryGame}
                  </button>
                  <button className="secondary" onClick={() => session.exitDiagnosticGame()}>
                    {pl.back}
                  </button>
                </>
              )}
              {stage === 'RESULT' && state.controlMode === 'GESTURE' && (
                <>
                  <p className="lead">{state.rounds === 1 ? pl.swapHelp : pl.partnerHelp}</p>
                  {state.rounds === 1 && (
                    <button className="primary" onClick={() => session.swap()}>
                      {pl.swap}
                      <span>→</span>
                    </button>
                  )}
                  <button
                    className={state.rounds === 1 ? 'secondary' : 'primary'}
                    onClick={() => void session.play()}
                  >
                    {pl.retryGame}
                  </button>
                  <button className="secondary" onClick={() => session.improve()}>
                    {pl.improve}
                  </button>
                  {state.rounds > 1 && (
                    <button className="quiet" onClick={() => session.finish()}>
                      {pl.finish}
                    </button>
                  )}
                </>
              )}
              {stage === 'PARTNER' && (
                <>
                  <p className="lead">{pl.swapHelp}</p>
                  <p>{pl.partnerHelp}</p>
                  <button className="primary" onClick={() => session.test()}>
                    {pl.swapCheck}
                    <span>→</span>
                  </button>
                </>
              )}
              {stage === 'END' && (
                <>
                  <p className="lead">{pl.endHelp}</p>
                  <p>{pl.endNote}</p>
                </>
              )}
            </>
          )}
          {state.slow && showCamera && <p className="note">{pl.slow}</p>}
        </section>
        {stage === 'GAME' && (
          <section className="game-panel">
            <div className="game-heading">
              <div>
                <h2>{pl.gameTitle}</h2>
                <p>{pl.gameHelp}</p>
              </div>
              <div className="score">
                <span>{pl.score}</span>
                <strong>{state.score}</strong>
              </div>
            </div>
            <div className="game-container">
              <GameView key={state.gameRound} controller={session.game} />
              {state.paused && (
                <div className="pause-overlay">
                  <h2>{pl.paused}</h2>
                  <p>{pl.pausedHelp}</p>
                  <button
                    className="primary"
                    disabled={!!state.error}
                    onClick={() => session.resume()}
                  >
                    {pl.resume}
                  </button>
                </div>
              )}
            </div>
            {state.error && (
              <div className="error" role="alert">
                <p>{pl.errors[state.error]}</p>
                <button disabled={busy} onClick={() => void session.retry()}>
                  {pl.retry}
                </button>
              </div>
            )}
          </section>
        )}
      </main>
      <footer>
        <span>
          <i className="privacy-dot" />
          {pl.privacy}
        </span>
        <button className="instructor-link" onClick={() => setInstructor(true)}>
          {pl.instructor.title}
          <kbd>⌃ ⇧ D</kbd>
        </button>
      </footer>
      {instructor && <InstructorPanel session={session} onClose={() => setInstructor(false)} />}
    </div>
  );
}
