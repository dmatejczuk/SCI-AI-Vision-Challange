import { describe, expect, it } from 'vitest';
import { DatasetManager } from '../src/features/dataset/DatasetManager';
import { config } from '../src/config/settings';
describe('DatasetManager', () => {
  it('bounds RAM and validates embeddings', () => {
    const data = new DatasetManager();
    expect(() => data.add('OPEN', new Float32Array(2))).toThrow();
    for (let i = 0; i < 200; i++) data.add('OPEN', new Float32Array(config.embeddingSize));
    expect(data.counts.OPEN).toBe(config.maximumSamples);
    expect(data.ready).toBe(false);
    expect(() => data.balanced()).toThrow('Insufficient');
    data.clear();
    expect(data.counts.OPEN).toBe(0);
  });
  it('balances classes without dropping earlier examples', () => {
    const data = new DatasetManager();
    for (let i = 0; i < 40; i++) data.add('OPEN', new Float32Array(config.embeddingSize));
    for (let i = 0; i < 20; i++) data.add('FIST', new Float32Array(config.embeddingSize));
    const balanced = data.balanced();
    expect(balanced.labels.filter((value) => value === 0)).toHaveLength(40);
    expect(balanced.labels.filter((value) => value === 1)).toHaveLength(40);
  });
});
