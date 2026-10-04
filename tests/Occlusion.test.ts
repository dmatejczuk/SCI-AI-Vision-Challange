import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeOcclusion } from '../src/features/explanation/Occlusion';
import type { InferenceSnapshot } from '../src/features/explanation/types';
import type { InferencePipeline } from '../src/features/prediction/InferencePipeline';
import { GestureController } from '../src/features/prediction/GestureController';
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  vi.stubGlobal(
    'ImageData',
    class {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number,
      ) {}
    },
  );
  return {
    sourceFrame: { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4).fill(5) },
    inputMetadata: { crop: { left: 2, top: 2, size: 4 } },
    predictedClass: 'OPEN',
    confidence: 0.7,
    gesturePreview: new GestureController().preview(0.7, 0.3),
  } as InferenceSnapshot;
}
describe('Occlusion cancellation and source isolation', () => {
  it('cancels after the last inference, masks one region at a time and clears temporary buffers', async () => {
    const snapshot = fixture();
    let cancelled = false;
    let work: ImageData | undefined;
    const outputs: Float32Array[] = [];
    const predict = vi.fn(async (frame: ImageData) => {
      work = frame;
      expect(Array.from(frame.data).filter((v) => v === 128)).toHaveLength(3);
      const featureVector = new Float32Array([1, 2]);
      outputs.push(featureVector);
      return {
        featureVector,
        inputValues: null,
        preparedFrame: null,
        classScores: { open: 0.2, fist: 0.8 },
      };
    });
    const result = await analyzeOcclusion(
      snapshot,
      { predict } as unknown as InferencePipeline,
      4,
      () => cancelled,
      (p) => {
        if (p === 1) cancelled = true;
      },
    );
    expect(result).toBeNull();
    expect(predict).toHaveBeenCalledTimes(16);
    expect(work?.data.every((v) => v === 0)).toBe(true);
    expect(outputs.every((v) => v.every((n) => n === 0))).toBe(true);
    expect(snapshot.sourceFrame.data.every((v) => v === 5)).toBe(true);
  });
  it('clears the mask buffer when inference fails and leaves the snapshot intact', async () => {
    const snapshot = fixture();
    let work: ImageData | undefined;
    const predict = vi.fn(async (frame: ImageData) => {
      work = frame;
      throw new Error('Inference failed');
    });
    await expect(
      analyzeOcclusion(
        snapshot,
        { predict } as unknown as InferencePipeline,
        4,
        () => false,
        () => {},
      ),
    ).rejects.toThrow('Inference failed');
    expect(work?.data.every((v) => v === 0)).toBe(true);
    expect(snapshot.sourceFrame.data.every((v) => v === 5)).toBe(true);
  });
});
