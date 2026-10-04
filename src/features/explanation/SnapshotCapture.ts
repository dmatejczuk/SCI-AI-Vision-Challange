import { histogram } from './labMath';
import type { InferencePipeline } from '../prediction/InferencePipeline';
import type { GestureController } from '../prediction/GestureController';
import type { SampleCounts } from '../../types';
import { releaseSnapshot, type InferenceSnapshot } from './types';

export function freezeVideo(video: HTMLVideoElement): ImageData {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight)
    throw new Error('Camera frame unavailable');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas context unavailable');
  try {
    context.drawImage(video, 0, 0);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export class SnapshotCapture {
  constructor(private pipeline: InferencePipeline) {}
  async capture(
    video: HTMLVideoElement,
    controller: GestureController,
    samples: SampleCounts,
    id: number,
    modelRevision: number,
    signal: AbortSignal,
  ): Promise<InferenceSnapshot> {
    const sourceFrame = freezeVideo(video);
    const timestamp = Date.now();
    const frozenController = controller.clone();
    const settings = { ...frozenController.settings };
    let snapshot: InferenceSnapshot | null = null;
    try {
      const result = await this.pipeline.predict(sourceFrame, settings, true);
      if (!result.preparedFrame || !result.inputValues)
        throw new Error('Prepared frame unavailable');
      snapshot = {
        id,
        timestamp,
        modelRevision,
        sourceFrame,
        preparedFrame: result.preparedFrame,
        inputMetadata: result.metadata,
        featureVector: result.featureVector,
        inputValues: result.inputValues,
        histogram: histogram(sourceFrame),
        history: [],
        trainingMeans: null,
        pca: null,
        activations: null,
        classScores: result.classScores,
        predictedClass: result.predictedClass,
        confidence: result.confidence,
        acceptedGesture: result.acceptedGesture,
        samples: { ...samples },
        timings: result.timings,
        gesturePreview: frozenController.preview(result.classScores.open, result.classScores.fist),
      };
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      return snapshot;
    } catch (error) {
      sourceFrame.data.fill(0);
      releaseSnapshot(snapshot);
      throw error;
    }
  }
}
