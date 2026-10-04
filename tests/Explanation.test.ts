import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as tf from '@tensorflow/tfjs';
import { aggregateFeatures } from '../src/features/explanation/featureVisualization';
import { interpretScores } from '../src/features/prediction/InferencePipeline';
import { GestureController } from '../src/features/prediction/GestureController';
import { defaults, config } from '../src/config/settings';
import { prepareInput } from '../src/features/training/preprocessing';
import { SessionManager } from '../src/services/SessionManager';
import type { InferenceSnapshot } from '../src/features/explanation/types';
import { SnapshotCapture } from '../src/features/explanation/SnapshotCapture';
import type { InferencePipeline } from '../src/features/prediction/InferencePipeline';
beforeAll(async () => {
  await tf.setBackend('cpu');
  await tf.ready();
});
describe('Frozen-frame explanation', () => {
  it('draws the camera exactly once and analyzes that captured pixel buffer', async () => {
    const frame = {
      data: new Uint8ClampedArray([10, 20, 30, 255]),
      width: 1,
      height: 1,
    } as ImageData;
    const drawImage = vi.fn();
    const getImageData = vi.fn(() => frame);
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage, getImageData }) };
    vi.stubGlobal('document', { createElement: () => canvas });
    const predict = vi.fn(async (source: ImageData) => {
      expect(source).toBe(frame);
      return {
        preparedFrame: { ...frame, data: frame.data.slice() },
        inputValues: new Float32Array([0, 0, 0]),
        metadata: {},
        featureVector: new Float32Array([0.2]),
        classScores: { open: 0.2, fist: 0.8 },
        predictedClass: 'FIST',
        confidence: 0.8,
        acceptedGesture: 'FIST',
        timings: {},
      };
    });
    try {
      const capture = new SnapshotCapture({ predict } as unknown as InferencePipeline);
      const result = await capture.capture(
        { readyState: 2, videoWidth: 1, videoHeight: 1 } as HTMLVideoElement,
        new GestureController(),
        { OPEN: 20, FIST: 20 },
        1,
        1,
        new AbortController().signal,
      );
      expect(result.sourceFrame).toBe(frame);
      expect(drawImage).toHaveBeenCalledOnce();
      expect(getImageData).toHaveBeenCalledOnce();
      expect(predict).toHaveBeenCalledOnce();
      expect(canvas.width).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('aggregates actual contiguous values for arbitrary vector sizes', () => {
    for (const size of [0, 1, 7, 256, 1024, 2049]) {
      const result = aggregateFeatures(new Float32Array(size).fill(-2));
      expect(result.length).toBe(Math.min(size, 48));
      expect(result.every((value) => value === -2)).toBe(true);
    }
    expect(aggregateFeatures([1, 3, 5, 7], 2)).toEqual([2, 6]);
    expect(aggregateFeatures([NaN, Infinity])).toEqual([0, 0]);
  });
  it('separates raw argmax from threshold acceptance', () => {
    expect(interpretScores({ open: 0.45, fist: 0.55 }, defaults)).toEqual({
      predictedClass: 'FIST',
      confidence: 0.55,
      acceptedGesture: null,
    });
    expect(interpretScores({ open: 0.94, fist: 0.06 }, defaults)).toEqual({
      predictedClass: 'OPEN',
      confidence: 0.94,
      acceptedGesture: 'OPEN',
    });
  });
  it('previews one prediction without changing the real transition state or streak', () => {
    const controller = new GestureController();
    controller.update(0.99, 0.01);
    controller.update(0.99, 0.01);
    controller.update(0.01, 0.99);
    const frozen = controller.clone();
    for (let i = 0; i < 5; i++) expect(frozen.preview(0.01, 0.99).jump).toBe(true);
    expect(controller.state).toBe('ARMED');
    expect(controller.update(0.01, 0.99)).toBe(true);
    expect(controller.update(0.01, 0.99)).toBe(false);
  });
  it('uses actual central crop, configured resize, horizontal mirror and normalization without leaked tensors', async () => {
    const baseline = tf.memory().numTensors;
    const data = new Uint8Array(4 * 2 * 4);
    for (let i = 0; i < 8; i++) {
      data[i * 4] = [17, 0, 255, 33][i % 4];
      data[i * 4 + 3] = 255;
    }
    const source = { data, width: 4, height: 2 } as unknown as ImageData;
    const { input, metadata } = prepareInput(source);
    expect(metadata.crop).toEqual({ left: 1, top: 0, size: 2 });
    expect(input.shape).toEqual([1, config.imageSize, config.imageSize, 3]);
    const values = await input.data();
    expect(values[0]).toBe(1);
    expect(values[(config.imageSize - 1) * 3]).toBe(-1);
    input.dispose();
    expect(tf.memory().numTensors).toBe(baseline);
  });
  it('navigates without new inference, clears images on retry and clears all summaries on new group', async () => {
    const session = new SessionManager();
    vi.spyOn(session.predictor, 'start').mockImplementation(() => {});
    for (let i = 0; i < config.minimumSamples; i++)
      for (const label of ['OPEN', 'FIST'] as const)
        session.dataset.add(
          label,
          new Float32Array(config.embeddingSize).fill(label === 'OPEN' ? 1 : -1),
        );
    await session.train();
    session.test();
    await session.openExplanation();
    const frame = () =>
      ({ data: new Uint8ClampedArray(4).fill(255), width: 1, height: 1 }) as ImageData;
    const snapshot: InferenceSnapshot = {
      id: 1,
      timestamp: 1,
      modelRevision: 1,
      sourceFrame: frame(),
      preparedFrame: frame(),
      inputMetadata: {
        sourceWidth: 1,
        sourceHeight: 1,
        width: 1,
        height: 1,
        crop: { left: 0, top: 0, size: 1 },
        mirrored: true,
        shape: [1, 1, 1, 3],
        normalization: { divisor: 127.5, offset: -1 },
        normalizedRange: [-1, 1],
      },
      featureVector: new Float32Array([1, 2]),
      inputValues: new Float32Array([0.1, 0.2, 0.3]),
      histogram: [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)],
      history: [],
      trainingMeans: null,
      pca: null,
      activations: null,
      classScores: { open: 0.9, fist: 0.1 },
      predictedClass: 'OPEN',
      confidence: 0.9,
      acceptedGesture: 'OPEN',
      samples: { OPEN: 20, FIST: 20 },
      timings: { preprocessing: 1, extraction: 1, classification: 1, total: 3 },
      gesturePreview: session.gestures.preview(0.9, 0.1),
    };
    const capture = vi.spyOn(session.snapshotCapture, 'capture').mockResolvedValue(snapshot);
    const update = vi.spyOn(session.gestures, 'update');
    const jump = vi.spyOn(session.game, 'jump');
    await session.freezeExplanation();
    for (const step of [2, 3, 4, 5, 4, 3, 2, 1] as const) session.explanationStep(step);
    expect(capture).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
    expect(jump).not.toHaveBeenCalled();
    expect(session.getSnapshot().explanation.snapshot).toBe(snapshot);
    const second = structuredClone(snapshot);
    second.id = 2;
    session.anotherFrame(false, true);
    expect(session.getSnapshot().explanation.comparison).toBe(snapshot);
    expect(snapshot.sourceFrame.data[0]).toBe(255);
    capture.mockResolvedValue(second);
    await session.freezeExplanation();
    const third = structuredClone(second);
    third.id = 3;
    session.anotherFrame(false, true);
    expect(session.getSnapshot().explanation.comparison).toBe(second);
    capture.mockResolvedValue(third);
    await session.freezeExplanation();
    session.anotherFrame(true);
    expect(second.sourceFrame.data.every((value) => value === 0)).toBe(true);
    expect(third.inputValues.every((value) => value === 0)).toBe(true);
    expect(snapshot.sourceFrame.data.every((value) => value === 0)).toBe(true);
    expect(snapshot.preparedFrame.data.every((value) => value === 0)).toBe(true);
    expect(snapshot.featureVector.every((value) => value === 0)).toBe(true);
    expect(session.getSnapshot().explanation.previous?.confidence).toBe(0.9);
    expect(session.dataset.counts).toEqual({ OPEN: 20, FIST: 20 });
    session.improve();
    await session.train();
    session.test();
    await session.openExplanation();
    expect(session.getSnapshot().modelRevision).toBe(2);
    expect(session.getSnapshot().explanation.previous?.modelRevision).toBe(1);
    expect(session.getSnapshot().explanation.snapshot).toBeNull();
    await session.resetSession();
    expect(session.getSnapshot().explanation).toEqual({
      step: 0,
      snapshot: null,
      previous: null,
      comparison: null,
      detailed: false,
      partnerExperiment: false,
      analysisCount: 0,
    });
    vi.restoreAllMocks();
  });
});
