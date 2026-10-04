import type { OcclusionResult } from './Occlusion';
import type { Histogram, PcaResult } from './labMath';
import type { HistoryPoint } from '../prediction/PredictionHistory';
import type { Gesture, SampleCounts } from '../../types';
import type { GesturePreview } from '../prediction/GestureController';

export type PixelSource = HTMLVideoElement | HTMLCanvasElement | ImageData;
export interface InputMetadata {
  sourceWidth: number;
  sourceHeight: number;
  crop: { left: number; top: number; size: number };
  width: number;
  height: number;
  mirrored: true;
  shape: number[];
  normalization: { divisor: number; offset: number };
  normalizedRange: readonly [-1, 1];
}
export interface ClassScores {
  open: number;
  fist: number;
}
export interface SnapshotSummary {
  id: number;
  timestamp: number;
  modelRevision: number;
  classScores: ClassScores;
  predictedClass: Gesture;
  confidence: number;
}
export interface InferenceSnapshot extends SnapshotSummary {
  sourceFrame: ImageData;
  preparedFrame: ImageData;
  inputMetadata: InputMetadata;
  featureVector: Float32Array;
  inputValues: Float32Array;
  histogram: Histogram;
  history: HistoryPoint[];
  trainingMeans: { open: Float32Array; fist: Float32Array; difference: Float32Array } | null;
  pca: PcaResult | null;
  activations: ActivationLayer[] | null;
  occlusion?: OcclusionResult;
  acceptedGesture: Gesture | null;
  samples: SampleCounts;
  gesturePreview: GesturePreview;
  timings: { preprocessing: number; extraction: number; classification: number; total: number };
}
export interface ActivationLayer {
  name: string;
  width: number;
  height: number;
  channels: { index: number; mean: number; values: Float32Array }[];
}
export type ExplanationStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export interface ExplanationState {
  step: ExplanationStep;
  snapshot: InferenceSnapshot | null;
  previous: SnapshotSummary | null;
  comparison: InferenceSnapshot | null;
  detailed: boolean;
  partnerExperiment: boolean;
  analysisCount: number;
  challenge?: boolean;
}
export const emptyExplanation = (): ExplanationState => ({
  step: 0,
  snapshot: null,
  previous: null,
  comparison: null,
  detailed: false,
  partnerExperiment: false,
  analysisCount: 0,
});

export function summarizeSnapshot(snapshot: InferenceSnapshot): SnapshotSummary {
  const { id, timestamp, modelRevision, classScores, predictedClass, confidence } = snapshot;
  return {
    id,
    timestamp,
    modelRevision,
    classScores: { ...classScores },
    predictedClass,
    confidence,
  };
}
export function releaseSnapshot(snapshot: InferenceSnapshot | null) {
  if (!snapshot) return;
  snapshot.occlusion?.scores.fill(0);
  snapshot.occlusion?.deltas.fill(0);
  snapshot.sourceFrame.data.fill(0);
  snapshot.preparedFrame.data.fill(0);
  snapshot.featureVector.fill(0);
  snapshot.inputValues.fill(0);
  snapshot.histogram.forEach((values) => values.fill(0));
  snapshot.history.length = 0;
  if (snapshot.trainingMeans)
    Object.values(snapshot.trainingMeans).forEach((values) => values.fill(0));
  snapshot.pca?.points.splice(0);
  snapshot.activations?.forEach((layer) =>
    layer.channels.forEach((channel) => channel.values.fill(0)),
  );
}
