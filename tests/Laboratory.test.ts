import { describe, it, expect } from 'vitest';
import {
  histogram,
  statistics,
  sourceToInput,
  tensorPixel,
  projectPca,
  pixelAt,
} from '../src/features/explanation/labMath';
import { PredictionHistory } from '../src/features/prediction/PredictionHistory';
import { DatasetManager } from '../src/features/dataset/DatasetManager';
import { config } from '../src/config/settings';
import { normalizePixel } from '../src/features/training/preprocessing';
describe('Laboratory numerical inspection', () => {
  it('reads RGB and counts each channel without counting alpha', () => {
    const frame = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([0, 128, 255, 7, 255, 128, 0, 200]),
    } as ImageData;
    expect(pixelAt(frame, 1, 0)).toEqual([255, 128, 0]);
    const h = histogram(frame);
    expect(h.map((channel) => channel.reduce((a, b) => a + b, 0))).toEqual([2, 2, 2]);
    expect(h[1][128]).toBe(2);
    expect(h[0][7]).toBe(0);
    expect(h[2][255]).toBe(1);
  });
  it('maps only cropped source pixels through resize and mirror and reads unrounded floats', () => {
    const m = {
      sourceWidth: 8,
      sourceHeight: 4,
      crop: { left: 2, top: 0, size: 4 },
      width: 2,
      height: 2,
      mirrored: true as const,
      normalizedRange: [-1, 1] as const,
      shape: [1, 2, 2, 3],
      normalization: { divisor: 127.5, offset: -1 },
    };
    expect(sourceToInput(1, 0, m)).toBeNull();
    expect(sourceToInput(6, 0, m)).toBeNull();
    expect(sourceToInput(2, 0, m)).toEqual({ x: 1, y: 0 });
    expect(sourceToInput(4, 2, m)).toEqual({ x: 0, y: 1 });
    const values = Float32Array.from({ length: 12 }, (_, i) => i / 13);
    expect(tensorPixel(values, 2, 0, 1)).toEqual(Array.from(values.slice(6, 9)));
    expect(normalizePixel(0)).toBe(-1);
    expect(normalizePixel(255)).toBe(1);
    expect(normalizePixel(127.5)).toBe(0);
  });
  it('calculates population statistics and near-zero counts for different vector sizes', () => {
    expect(statistics(new Float32Array([-2, 0, 2, 4]))).toEqual({
      count: 4,
      min: -2,
      max: 4,
      mean: 1,
      median: 1,
      deviation: Math.sqrt(5),
      nearZero: 1,
    });
    expect(statistics([1, 2, 3]).median).toBe(2);
    expect(statistics([]).count).toBe(0);
    expect(statistics([0, 1e-7, -1e-7, 0.1]).nearZero).toBe(3);
  });
  it('PCA preserves known rank-one distances and does not fit the current frame', () => {
    const rows = [-2, -1, 1, 2].map((x, i) => ({
      label: i < 2 ? ('OPEN' as const) : ('FIST' as const),
      values: new Float32Array([x, x * 2, 3]),
    }));
    const result = projectPca(rows, new Float32Array([100, 200, 3]));
    expect(result.points).toHaveLength(5);
    expect(result.explained[0]).toBeCloseTo(1, 8);
    expect(result.explained[1]).toBeCloseTo(0, 8);
    expect(Math.abs(result.points[0].x - result.points[1].x)).toBeCloseTo(Math.sqrt(5), 8);
    expect(Math.abs(result.points[4].x)).toBeCloseTo(100 * Math.sqrt(5), 6);
    expect(result.points.slice(0, 4).reduce((sum, p) => sum + p.x, 0)).toBeCloseTo(0, 8);
    const flat = projectPca(
      rows.map((row) => ({ ...row, values: new Float32Array([1, 1, 1]) })),
      new Float32Array([1, 1, 1]),
    );
    expect(flat.explained).toEqual([0, 0]);
    expect(flat.points.every((p) => p.x === 0 && p.y === 0)).toBe(true);
  });
  it('class means use original examples and copies cannot mutate the dataset', () => {
    const data = new DatasetManager();
    data.add('OPEN', new Float32Array(config.embeddingSize).fill(2));
    data.add('OPEN', new Float32Array(config.embeddingSize).fill(4));
    data.add('FIST', new Float32Array(config.embeddingSize).fill(-1));
    expect(data.means().open[0]).toBe(3);
    expect(data.means().fist[0]).toBe(-1);
    expect(data.means().difference[0]).toBe(4);
    data.examples()[0].values.fill(99);
    expect(data.means().open[0]).toBe(3);
    data.clear();
  });
  it('history is bounded, chronological, limited to three seconds and clears on reset', () => {
    const history = new PredictionHistory();
    for (let i = 0; i < 200; i++)
      history.add({
        timestamp: i * 10,
        open: 0.9,
        fist: 0.1,
        accepted: 'OPEN',
        jump: false,
        sentToGame: false,
        context: 'LAB',
        openThreshold: 0.82,
        fistThreshold: 0.8,
      });
    expect(history.read(2000)).toHaveLength(90);
    expect(history.read(2000)[0].timestamp).toBe(1100);
    history.read(2000)[0].open = 0;
    expect(history.read(2000)[0].open).toBe(0.9);
    expect(history.read(6000)).toEqual([]);
    history.clear();
    expect(history.read(2000)).toEqual([]);
  });
});
