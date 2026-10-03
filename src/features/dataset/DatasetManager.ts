import { config } from '../../config/settings';
import type { Gesture, SampleCounts } from '../../types';
export class DatasetManager {
  private samples: Record<Gesture, Float32Array[]> = { OPEN: [], FIST: [] };
  get counts(): SampleCounts {
    return { OPEN: this.samples.OPEN.length, FIST: this.samples.FIST.length };
  }
  get ready() {
    return Object.values(this.counts).every((count) => count >= config.minimumSamples);
  }
  add(label: Gesture, embedding: Float32Array) {
    if (embedding.length !== config.embeddingSize || !embedding.every(Number.isFinite))
      throw new Error('Invalid embedding');
    if (this.samples[label].length >= config.maximumSamples) return false;
    this.samples[label].push(embedding.slice());
    return true;
  }
  balanced() {
    if (!this.ready) throw new Error('Insufficient training data');
    const count = Math.max(this.counts.OPEN, this.counts.FIST);
    const values: number[][] = [],
      labels: number[] = [];
    for (let index = 0; index < count; index++)
      for (const [classIndex, label] of (['OPEN', 'FIST'] as const).entries()) {
        values.push(Array.from(this.samples[label][index % this.samples[label].length]));
        labels.push(classIndex);
      }
    return { values, labels };
  }
  clear() {
    for (const samples of Object.values(this.samples)) for (const sample of samples) sample.fill(0);
    this.samples = { OPEN: [], FIST: [] };
  }
}
