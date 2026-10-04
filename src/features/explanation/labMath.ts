import type { InputMetadata } from './types';

export type Histogram = [Uint32Array, Uint32Array, Uint32Array];
export function histogram(frame: ImageData): Histogram {
  const result: Histogram = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (let i = 0; i < frame.data.length; i += 4)
    for (let c = 0; c < 3; c++) result[c][frame.data[i + c]]++;
  return result;
}
export function statistics(values: ArrayLike<number>) {
  const sorted = Array.from(values).sort((a, b) => a - b);
  const count = sorted.length;
  if (!count) return { count: 0, min: 0, max: 0, mean: 0, median: 0, deviation: 0, nearZero: 0 };
  const mean = sorted.reduce((sum, v) => sum + v, 0) / count;
  return {
    count,
    min: sorted[0],
    max: sorted[count - 1],
    mean,
    median: (sorted[Math.floor((count - 1) / 2)] + sorted[Math.floor(count / 2)]) / 2,
    deviation: Math.sqrt(sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / count),
    nearZero: sorted.filter((v) => Math.abs(v) < 1e-6).length,
  };
}
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export function pixelAt(frame: ImageData, x: number, y: number) {
  const offset =
    (clamp(Math.floor(y), 0, frame.height - 1) * frame.width +
      clamp(Math.floor(x), 0, frame.width - 1)) *
    4;
  return [frame.data[offset], frame.data[offset + 1], frame.data[offset + 2]];
}
// Nearest output location, not a claimed one-to-one mapping: bilinear resize mixes samples.
export function sourceToInput(x: number, y: number, m: InputMetadata) {
  const { left, top, size } = m.crop;
  if (x < left || y < top || x >= left + size || y >= top + size) return null;
  return {
    x: m.width - 1 - clamp(Math.round(((x - left) * m.width) / size), 0, m.width - 1),
    y: clamp(Math.round(((y - top) * m.height) / size), 0, m.height - 1),
  };
}
export function tensorPixel(values: Float32Array, width: number, x: number, y: number) {
  return Array.from(values.slice((y * width + x) * 3, (y * width + x) * 3 + 3));
}

export interface PcaPoint {
  x: number;
  y: number;
  label: 'OPEN' | 'FIST' | 'CURRENT';
  index: number;
}
export interface PcaResult {
  points: PcaPoint[];
  explained: number[];
}
// Centered PCA via covariance-vector products. Fit ONLY on original training samples;
// project the current frame with the same mean/basis. No N×N or D×D matrix is retained.
export function projectPca(
  samples: { label: 'OPEN' | 'FIST'; values: Float32Array }[],
  current: Float32Array,
): PcaResult {
  const d = current.length,
    n = samples.length;
  if (n < 2 || !d) return { points: [], explained: [0, 0] };
  const mean = new Float64Array(d);
  for (const row of samples) for (let j = 0; j < d; j++) mean[j] += row.values[j] / n;
  const rows = samples.map((row) => Float64Array.from(row.values, (v, j) => v - mean[j]));
  const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => {
    let sum = 0;
    for (let j = 0; j < d; j++) sum += a[j] * b[j];
    return sum;
  };
  const multiply = (v: Float64Array) => {
    const out = new Float64Array(d);
    for (const row of rows) {
      const weight = dot(row, v) / (n - 1);
      for (let j = 0; j < d; j++) out[j] += row[j] * weight;
    }
    return out;
  };
  const basis: Float64Array[] = [],
    eigenvalues: number[] = [];
  for (let component = 0; component < 2; component++) {
    // Multiple deterministic starts avoid an unlucky vector orthogonal to the leading direction.
    let best = new Float64Array(d),
      bestValue = 0;
    for (let seed = 0; seed < 3; seed++) {
      let v: Float64Array<ArrayBufferLike> = Float64Array.from({ length: d }, (_, j) =>
        Math.sin((j + 1) * (seed + 1) * 1.618),
      );
      for (let iteration = 0; iteration < 60; iteration++) {
        const w = multiply(v);
        for (const axis of basis) {
          const projection = dot(w, axis);
          for (let j = 0; j < d; j++) w[j] -= projection * axis[j];
        }
        const norm = Math.sqrt(dot(w, w));
        if (norm < 1e-12) {
          v = new Float64Array(d);
          break;
        }
        v = w.map((value) => value / norm);
      }
      const eigenvalue = dot(v, multiply(v));
      if (eigenvalue > bestValue) {
        bestValue = eigenvalue;
        best = Float64Array.from(v);
      }
    }
    basis.push(best);
    eigenvalues.push(bestValue);
  }
  const total = rows.reduce((sum, row) => sum + dot(row, row), 0) / (n - 1);
  const point = (row: ArrayLike<number>, label: PcaPoint['label'], index: number): PcaPoint => ({
    x: dot(row, basis[0]),
    y: dot(row, basis[1]),
    label,
    index,
  });
  return {
    points: [
      ...rows.map((row, i) => point(row, samples[i].label, i)),
      point(
        Float64Array.from(current, (v, j) => v - mean[j]),
        'CURRENT',
        n,
      ),
    ],
    explained: eigenvalues.map((v) => (total > 0 ? v / total : 0)),
  };
}
