import type { InferenceSnapshot } from './types';
import type { InferencePipeline } from '../prediction/InferencePipeline';
export interface OcclusionResult {
  grid: number;
  scores: Float32Array;
  deltas: Float32Array;
}
export function regionBounds(snapshot: InferenceSnapshot, grid: number, index: number) {
  const { left, top, size } = snapshot.inputMetadata.crop;
  const col = index % grid,
    row = Math.floor(index / grid);
  const x = left + Math.floor((col * size) / grid),
    y = top + Math.floor((row * size) / grid);
  return {
    x,
    y,
    width: left + Math.floor(((col + 1) * size) / grid) - x,
    height: top + Math.floor(((row + 1) * size) / grid) - y,
  };
}
export async function analyzeOcclusion(
  snapshot: InferenceSnapshot,
  pipeline: InferencePipeline,
  grid: number,
  cancelled: () => boolean,
  progress: (v: number) => void,
): Promise<OcclusionResult | null> {
  if (![4, 8].includes(grid)) throw new Error('Invalid occlusion grid');
  const frame = new ImageData(
    new Uint8ClampedArray(snapshot.sourceFrame.data),
    snapshot.sourceFrame.width,
    snapshot.sourceFrame.height,
  );
  const result: OcclusionResult = {
    grid,
    scores: new Float32Array(grid * grid),
    deltas: new Float32Array(grid * grid),
  };
  let completed = false;
  try {
    for (let i = 0; i < grid * grid; i++) {
      if (cancelled()) return null;
      frame.data.set(snapshot.sourceFrame.data);
      const r = regionBounds(snapshot, grid, i);
      for (let y = r.y; y < r.y + r.height; y++)
        for (let x = r.x; x < r.x + r.width; x++) {
          const offset = (y * frame.width + x) * 4;
          frame.data[offset] = 128;
          frame.data[offset + 1] = 128;
          frame.data[offset + 2] = 128;
        }
      const prediction = await pipeline.predict(frame, {
        ...snapshot.gesturePreview,
        inferenceHz: 15,
      });
      try {
        if (cancelled()) return null;
        const score = prediction.classScores[snapshot.predictedClass === 'OPEN' ? 'open' : 'fist'];
        result.scores[i] = score;
        result.deltas[i] = snapshot.confidence - score;
        progress((i + 1) / (grid * grid));
      } finally {
        prediction.featureVector.fill(0);
        prediction.inputValues?.fill(0);
        prediction.preparedFrame?.data.fill(0);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (cancelled()) return null;
    completed = true;
    return result;
  } finally {
    frame.data.fill(0);
    if (!completed) {
      result.scores.fill(0);
      result.deltas.fill(0);
    }
  }
}
