import * as tf from '@tensorflow/tfjs';
import { config, defaults, type GestureSettings } from '../config/settings';
import { CameraService } from '../features/camera/CameraService';
import { DatasetManager } from '../features/dataset/DatasetManager';
import { FeatureExtractor } from '../features/training/FeatureExtractor';
import { ModelTrainer } from '../features/training/ModelTrainer';
import { GestureController } from '../features/prediction/GestureController';
import { PredictionService } from '../features/prediction/PredictionService';
import { GameController } from '../features/game/GameController';
import type { Gesture, Prediction, SampleCounts, Stage } from '../types';
import { abortable } from '../utils/abortable';
type ErrorKind =
  | 'camera'
  | 'denied'
  | 'missing'
  | 'secure'
  | 'lost'
  | 'model'
  | 'training'
  | 'prediction'
  | 'data';
interface Snapshot {
  stage: Stage;
  counts: SampleCounts;
  progress: number;
  busy: boolean;
  error: ErrorKind | null;
  detail: string;
  prediction: Prediction;
  settings: GestureSettings;
  partner: boolean;
  rounds: number;
  gameRound: number;
  controlMode: 'GESTURE' | 'KEYBOARD';
  score: number;
  trained: boolean;
  cameraLabel: string;
  armed: boolean;
  paused: boolean;
  resetting: boolean;
  slow: boolean;
}
const initial = (): Snapshot => ({
  stage: 'START',
  counts: { OPEN: 0, FIST: 0 },
  progress: 0,
  busy: false,
  error: null,
  detail: '',
  prediction: { open: 0, fist: 0, gesture: null, latency: 0, fps: 0 },
  settings: { ...defaults },
  partner: false,
  rounds: 0,
  gameRound: 0,
  controlMode: 'GESTURE',
  score: 0,
  trained: false,
  cameraLabel: '',
  armed: false,
  paused: false,
  resetting: false,
  slow: false,
});
export class SessionManager {
  dataset = new DatasetManager();
  extractor = new FeatureExtractor();
  trainer = new ModelTrainer();
  gestures = new GestureController();
  predictor = new PredictionService();
  game = new GameController();
  camera = new CameraService(() => this.fail('lost', new Error('Camera track ended')));
  private snapshot = initial();
  private listeners = new Set<() => void>();
  private abort = new AbortController();
  private operation: Promise<void> = Promise.resolve();
  private video: HTMLVideoElement | null = null;
  private retryAction: (() => Promise<void>) | null = null;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  constructor() {
    this.game.onScore = (score) => this.patch({ score });
    this.game.onOver = (score) => {
      this.predictor.stop();
      this.gestures.reset();
      this.patch({
        stage: 'RESULT',
        score,
        rounds: this.snapshot.rounds + (this.snapshot.controlMode === 'GESTURE' ? 1 : 0),
        armed: false,
      });
    };
  }
  private patch(values: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...values };
    this.listeners.forEach((listener) => listener());
  }
  attachVideo(video: HTMLVideoElement) {
    this.video = video;
  }
  private run(action: (signal: AbortSignal) => Promise<void>, kind: ErrorKind) {
    if (this.snapshot.busy || this.snapshot.resetting) return Promise.resolve();
    const signal = this.abort.signal;
    this.patch({ busy: true, error: null, progress: 0 });
    this.operation = (async () => {
      try {
        await this.predictor.idle();
        if (!signal.aborted) await action(signal);
      } catch (error) {
        if (!signal.aborted) this.fail(kind, error);
      } finally {
        if (!signal.aborted) this.patch({ busy: false });
      }
    })();
    return this.operation;
  }
  private fail(kind: ErrorKind, error: unknown) {
    console.error(`[Session:${kind}]`, error);
    if (kind === 'camera') {
      if (error instanceof DOMException && error.name === 'NotAllowedError') kind = 'denied';
      else if (error instanceof DOMException && error.name === 'NotFoundError') kind = 'missing';
      else if (error instanceof Error && error.message === 'INSECURE_CONTEXT') kind = 'secure';
    }
    this.predictor.stop();
    this.gestures.reset();
    if (this.snapshot.stage === 'GAME') this.pause();
    this.patch({
      error: kind,
      cameraLabel: ['camera', 'denied', 'missing', 'secure', 'lost'].includes(kind)
        ? ''
        : this.snapshot.cameraLabel,
      detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      armed: false,
    });
  }
  async start() {
    this.retryAction = () => this.start();
    this.patch({ stage: 'LOADING' });
    return this.run(async (signal) => {
      if (!this.video) throw new Error('Video not attached');
      try {
        await abortable(this.camera.start(this.video), signal);
      } catch (error) {
        if (!signal.aborted) this.fail('camera', error);
        return;
      }
      if (signal.aborted) return;
      this.patch({ cameraLabel: this.camera.label });
      await this.extractor.load(signal);
      if (!signal.aborted) this.patch({ stage: 'OPEN' });
    }, 'model');
  }
  capture(label: Gesture) {
    if (this.snapshot.stage !== label) return Promise.resolve();
    this.retryAction = () => this.capture(label);
    return this.run(async (signal) => {
      const count = Math.min(
        config.captureCount,
        config.maximumSamples - this.dataset.counts[label],
      );
      for (let index = 0; index < count && !signal.aborted; index++) {
        const started = performance.now();
        const embedding = await this.extractor.extract(this.video!);
        if (signal.aborted) break;
        this.dataset.add(label, embedding);
        this.patch({
          counts: this.dataset.counts,
          progress: (index + 1) / count,
          slow: performance.now() - started > 180,
        });
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(0, config.captureInterval - (performance.now() - started))),
        );
      }
    }, 'prediction');
  }
  next() {
    if (this.snapshot.busy) return;
    if (this.snapshot.stage === 'OPEN' && this.dataset.counts.OPEN >= config.minimumSamples)
      this.patch({ stage: 'FIST', progress: 0 });
    else if (this.snapshot.stage === 'FIST' && this.dataset.ready)
      this.patch({ stage: 'READY', progress: 0 });
  }
  train() {
    if (!this.dataset.ready) {
      this.fail('data', new Error('Insufficient samples'));
      return Promise.resolve();
    }
    this.predictor.stop();
    this.retryAction = () => this.train();
    this.patch({ stage: 'TRAINING' });
    return this.run(async (signal) => {
      await this.trainer.train(this.dataset, signal, (progress) => this.patch({ progress }));
      if (!signal.aborted) this.patch({ stage: 'TRAINED', trained: true });
    }, 'training');
  }
  test() {
    if (!this.snapshot.trained || this.snapshot.busy) return;
    this.patch({ stage: 'TEST', error: null });
    this.beginPrediction();
  }
  private beginPrediction() {
    this.gestures.reset();
    let previous = performance.now();
    const signal = this.abort.signal;
    this.predictor.start(
      async () => {
        if (document.hidden || this.snapshot.paused) {
          this.gestures.reset();
          return;
        }
        const started = performance.now();
        const embedding = await this.extractor.extract(this.video!);
        const probabilities = await this.trainer.predict(embedding);
        if (signal.aborted || !['TEST', 'GAME'].includes(this.snapshot.stage)) return;
        const now = performance.now();
        const { open, fist } = probabilities;
        const jump = this.gestures.update(open, fist);
        const gesture =
          open >= this.snapshot.settings.openThreshold
            ? 'OPEN'
            : fist >= this.snapshot.settings.fistThreshold
              ? 'FIST'
              : null;
        this.patch({
          prediction: { open, fist, gesture, latency: now - started, fps: 1000 / (now - previous) },
          armed: this.gestures.state === 'ARMED',
          slow: now - started > 180,
        });
        previous = now;
        if (jump && this.snapshot.stage === 'GAME') this.game.jump();
      },
      () => this.snapshot.settings.inferenceHz,
      (error) => this.fail('prediction', error),
    );
  }
  async play(keyboardOnly = false) {
    if ((!this.snapshot.trained && !keyboardOnly) || this.snapshot.busy) return;
    const signal = this.abort.signal;
    this.predictor.stop();
    await this.predictor.idle();
    if (signal.aborted || this.snapshot.resetting) return;
    this.game.reset();
    this.gestures.reset();
    this.patch({
      stage: 'GAME',
      score: 0,
      paused: false,
      armed: false,
      error: null,
      gameRound: this.snapshot.gameRound + 1,
      controlMode: keyboardOnly ? 'KEYBOARD' : 'GESTURE',
    });
    if (!keyboardOnly && this.snapshot.trained && this.camera.stream) this.beginPrediction();
  }
  exitDiagnosticGame() {
    this.game.reset();
    this.patch({ stage: this.camera.stream ? 'OPEN' : 'START', score: 0 });
  }
  improve() {
    this.predictor.stop();
    this.gestures.reset();
    this.patch({ stage: 'OPEN', progress: 0, error: null, armed: false });
  }
  swap() {
    this.predictor.stop();
    this.patch({ stage: 'PARTNER', partner: true });
  }
  finish() {
    this.predictor.stop();
    this.camera.stop();
    this.patch({ stage: 'END', cameraLabel: '' });
  }
  pause() {
    this.gestures.reset();
    this.game.setPaused(true);
    this.patch({ paused: true, armed: false });
  }
  resume() {
    this.gestures.reset();
    this.game.setPaused(false);
    this.patch({ paused: false, armed: false });
  }
  configure(settings: GestureSettings) {
    this.gestures.settings = { ...settings };
    this.gestures.reset();
    this.patch({ settings: { ...settings }, armed: false });
  }
  restartCamera(deviceId?: string) {
    this.predictor.stop();
    if (this.snapshot.stage === 'GAME') this.pause();
    return this.run(async (signal) => {
      await abortable(this.camera.start(this.video!, deviceId), signal);
      if (signal.aborted) return;
      this.patch({ cameraLabel: this.camera.label });
      if (
        this.snapshot.stage === 'TEST' ||
        (this.snapshot.stage === 'GAME' && this.snapshot.controlMode === 'GESTURE')
      )
        this.beginPrediction();
    }, 'camera');
  }
  async retry() {
    const error = this.snapshot.error;
    this.patch({ error: null });
    if (this.snapshot.stage === 'LOADING') return this.start();
    if (['camera', 'denied', 'missing', 'secure', 'lost'].includes(error ?? ''))
      return this.restartCamera();
    if (['TEST', 'GAME'].includes(this.snapshot.stage)) {
      this.beginPrediction();
      return;
    }
    await this.retryAction?.();
  }
  async resetSession() {
    if (this.snapshot.resetting) return;
    this.abort.abort();
    this.predictor.stop();
    this.camera.stop();
    this.game.reset();
    this.patch({ resetting: true, stage: 'START' });
    await Promise.all([this.operation, this.predictor.idle()]);
    this.dataset.clear();
    this.trainer.dispose();
    this.extractor.dispose();
    this.gestures.reset();
    this.gestures.settings = { ...defaults };
    if (this.video) this.video.srcObject = null;
    this.retryAction = null;
    this.abort = new AbortController();
    this.snapshot = initial();
    this.listeners.forEach((listener) => listener());
  }
  diagnostics() {
    return {
      memory: tf.memory(),
      backend: tf.getBackend(),
      controller: this.gestures.state,
      fps: this.game.fps,
    };
  }
}
