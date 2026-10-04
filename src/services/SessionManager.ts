import { analyzeOcclusion } from '../features/explanation/Occlusion';
import { PredictionHistory } from '../features/prediction/PredictionHistory';
import { projectPca } from '../features/explanation/labMath';
import { InferencePipeline } from '../features/prediction/InferencePipeline';
import { SnapshotCapture } from '../features/explanation/SnapshotCapture';
import {
  emptyExplanation,
  releaseSnapshot,
  summarizeSnapshot,
  type ExplanationState,
  type ExplanationStep,
} from '../features/explanation/types';
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
  | 'data'
  | 'explanation';
interface Snapshot {
  explanation: ExplanationState;
  modelRevision: number;
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
  explanation: emptyExplanation(),
  modelRevision: 0,
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
  pipeline = new InferencePipeline(this.extractor, this.trainer);
  snapshotCapture = new SnapshotCapture(this.pipeline);
  gestures = new GestureController();
  predictor = new PredictionService();
  history = new PredictionHistory();
  private occlusionAbort: AbortController | null = null;
  private labController: GestureController | null = null;
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
    if (this.snapshot.stage !== 'EXPLAIN') this.gestures.reset();
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
      if (!signal.aborted)
        this.patch({
          stage: 'TRAINED',
          trained: true,
          modelRevision: this.snapshot.modelRevision + 1,
        });
    }, 'training');
  }
  test() {
    if (!this.snapshot.trained || this.snapshot.busy) return;
    this.clearExplanation(true);
    this.patch({ stage: 'TEST', error: null });
    this.beginPrediction();
  }
  private beginPrediction(laboratory = false) {
    if (!laboratory) this.gestures.reset();
    const controller = laboratory ? (this.labController ??= this.gestures.clone()) : this.gestures;
    let previous = performance.now();
    const signal = this.abort.signal;
    this.predictor.start(
      async () => {
        if (document.hidden || this.snapshot.paused) {
          if (!laboratory) this.gestures.reset();
          return;
        }
        const started = performance.now();
        const result = await this.pipeline.predict(this.video!, this.snapshot.settings);
        if (
          signal.aborted ||
          !(laboratory
            ? this.snapshot.stage === 'EXPLAIN' && !this.snapshot.explanation.snapshot
            : ['TEST', 'GAME'].includes(this.snapshot.stage))
        )
          return;
        const now = performance.now();
        const { open, fist } = result.classScores;
        const jump = controller.update(open, fist);
        this.history.add({
          timestamp: Date.now(),
          open,
          fist,
          accepted: result.acceptedGesture,
          jump,
          sentToGame: jump && this.snapshot.stage === 'GAME',
          context: laboratory ? 'LAB' : this.snapshot.stage === 'GAME' ? 'GAME' : 'TEST',
          openThreshold: controller.settings.openThreshold,
          fistThreshold: controller.settings.fistThreshold,
        });
        const gesture = result.acceptedGesture;
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
    this.clearExplanation();
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
    this.clearExplanation(true);
    this.predictor.stop();
    this.gestures.reset();
    this.patch({ stage: 'OPEN', progress: 0, error: null, armed: false });
  }
  swap() {
    this.predictor.stop();
    this.patch({ stage: 'PARTNER', partner: true });
  }
  finish() {
    this.clearExplanation();
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
    if (this.labController) {
      this.labController.settings = { ...settings };
      this.labController.reset();
    }
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
      else if (this.snapshot.stage === 'EXPLAIN' && !this.snapshot.explanation.snapshot)
        this.beginPrediction(true);
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
    if (this.snapshot.stage === 'EXPLAIN') return this.freezeExplanation();
    await this.retryAction?.();
  }
  async resetSession() {
    if (this.snapshot.resetting) return;
    this.abort.abort();
    this.occlusionAbort?.abort();
    this.history.clear();
    this.clearExplanation();
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
  private clearExplanation(keepSummary = false) {
    const current = this.snapshot.explanation;
    const previous = keepSummary
      ? current.snapshot
        ? summarizeSnapshot(current.snapshot)
        : current.previous
      : null;
    releaseSnapshot(current.snapshot);
    releaseSnapshot(current.comparison);
    this.labController = null;
    this.history.clear();
    this.patch({ explanation: { ...emptyExplanation(), previous } });
  }
  async openExplanation() {
    if (
      this.snapshot.stage !== 'TEST' ||
      !this.snapshot.trained ||
      this.snapshot.busy ||
      this.snapshot.error
    )
      return;
    this.predictor.stop();
    this.history.clear();
    this.labController = this.gestures.clone();
    this.patch({ stage: 'EXPLAIN' });
    await this.predictor.idle();
    if (
      this.getSnapshot().stage === 'EXPLAIN' &&
      !this.snapshot.busy &&
      !this.snapshot.explanation.snapshot
    )
      this.beginPrediction(true);
  }
  freezeExplanation() {
    if (this.snapshot.stage !== 'EXPLAIN' || this.snapshot.explanation.snapshot)
      return Promise.resolve();
    this.predictor.stop();
    return this.run(async (signal) => {
      const current = this.snapshot.explanation;
      const snapshot = await this.snapshotCapture.capture(
        this.video!,
        this.labController ?? this.gestures,
        this.dataset.counts,
        current.analysisCount + 1,
        this.snapshot.modelRevision,
        signal,
      );
      if (signal.aborted) {
        releaseSnapshot(snapshot);
        return;
      }
      snapshot.history = this.history.read(snapshot.timestamp);
      snapshot.trainingMeans = this.dataset.means();
      this.patch({
        explanation: {
          ...current,
          snapshot,
          step: current.challenge ? 6 : current.comparison ? 5 : 1,
          analysisCount: current.analysisCount + 1,
        },
      });
    }, 'explanation');
  }
  explanationStep(step: ExplanationStep) {
    if (
      this.snapshot.stage !== 'EXPLAIN' ||
      this.snapshot.busy ||
      !this.snapshot.explanation.snapshot ||
      step < 1 ||
      step > 8
    )
      return;
    this.patch({ explanation: { ...this.snapshot.explanation, step } });
  }
  anotherFrame(partnerExperiment = false, compare = false) {
    if (this.snapshot.busy || this.snapshot.stage !== 'EXPLAIN') return;
    const current = this.snapshot.explanation;
    const previous = current.snapshot ? summarizeSnapshot(current.snapshot) : current.previous;
    releaseSnapshot(current.comparison);
    if (!compare) releaseSnapshot(current.snapshot);
    const comparison = compare ? current.snapshot : null;
    this.patch({
      explanation: {
        ...current,
        snapshot: null,
        comparison,
        previous,
        step: 0,
        partnerExperiment,
        challenge: false,
      },
      error: null,
    });
    this.history.clear();
    this.labController = this.gestures.clone();
    this.beginPrediction(true);
  }
  setDetailed(detailed: boolean) {
    this.patch({ explanation: { ...this.snapshot.explanation, detailed } });
  }
  calculatePca() {
    const snapshot = this.snapshot.explanation.snapshot;
    if (!snapshot || this.snapshot.stage !== 'EXPLAIN' || this.snapshot.busy || snapshot.pca)
      return;
    const examples = this.dataset.examples();
    try {
      const pca = projectPca(examples, snapshot.featureVector);
      this.patch({ explanation: { ...this.snapshot.explanation, snapshot: { ...snapshot, pca } } });
    } finally {
      examples.forEach((example) => example.values.fill(0));
    }
  }
  inspectActivations() {
    const snapshot = this.snapshot.explanation.snapshot;
    if (!snapshot || this.snapshot.stage !== 'EXPLAIN' || snapshot.activations)
      return Promise.resolve();
    return this.run(async (signal) => {
      const activations = await this.extractor.inspectActivations(
        snapshot.inputValues,
        snapshot.inputMetadata.shape,
      );
      if (signal.aborted) {
        activations.forEach((layer) => layer.channels.forEach((channel) => channel.values.fill(0)));
        return;
      }
      this.patch({
        explanation: { ...this.snapshot.explanation, snapshot: { ...snapshot, activations } },
      });
    }, 'explanation');
  }
  inspectOcclusion(grid = 4) {
    const snapshot = this.snapshot.explanation.snapshot;
    if (!snapshot || this.snapshot.stage !== 'EXPLAIN' || this.snapshot.busy)
      return Promise.resolve();
    const local = new AbortController();
    this.occlusionAbort = local;
    return this.run(async (signal) => {
      try {
        const occlusion = await analyzeOcclusion(
          snapshot,
          this.pipeline,
          grid,
          () => signal.aborted || local.signal.aborted,
          (progress) => this.patch({ progress }),
        );
        if (!occlusion) return;
        if (signal.aborted || local.signal.aborted) {
          occlusion.scores.fill(0);
          occlusion.deltas.fill(0);
          return;
        }
        snapshot.occlusion?.scores.fill(0);
        snapshot.occlusion?.deltas.fill(0);
        this.patch({
          explanation: { ...this.snapshot.explanation, snapshot: { ...snapshot, occlusion } },
        });
      } finally {
        if (this.occlusionAbort === local) this.occlusionAbort = null;
      }
    }, 'explanation');
  }
  cancelOcclusion() {
    this.occlusionAbort?.abort();
  }
  challengeModel() {
    if (this.snapshot.busy || this.snapshot.stage !== 'EXPLAIN') return;
    this.anotherFrame();
    this.patch({ explanation: { ...this.snapshot.explanation, detailed: true, challenge: true } });
  }
  async addFrozenExample(label: Gesture) {
    const snapshot = this.snapshot.explanation.snapshot;
    if (
      !snapshot ||
      this.snapshot.busy ||
      this.snapshot.stage !== 'EXPLAIN' ||
      !['OPEN', 'FIST'].includes(label) ||
      this.dataset.counts[label] >= config.maximumSamples
    )
      return;
    this.dataset.add(label, snapshot.featureVector);
    this.patch({ counts: this.dataset.counts });
    this.clearExplanation(true);
    await this.train();
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
