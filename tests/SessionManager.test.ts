import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as tf from '@tensorflow/tfjs';
import { SessionManager } from '../src/services/SessionManager';
import { config, defaults } from '../src/config/settings';
beforeAll(async () => {
  await tf.setBackend('cpu');
  await tf.ready();
});
describe('Session lifecycle', () => {
  it('clears data, model, game and custom settings across repeated real training sessions without tensor leaks', async () => {
    const session = new SessionManager();
    const initialTensors = tf.memory().numTensors;
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < config.minimumSamples; i++) {
        session.dataset.add('OPEN', new Float32Array(config.embeddingSize).fill(0.4));
        session.dataset.add('FIST', new Float32Array(config.embeddingSize).fill(-0.4));
      }
      await session.train();
      expect(session.getSnapshot().stage).toBe('TRAINED');
      expect(
        (await session.trainer.predict(new Float32Array(config.embeddingSize).fill(0.4))).open,
      ).toBeGreaterThan(0.8);
      session.game.score = 200;
      session.configure({ ...defaults, fistThreshold: 0.92 });
      await session.resetSession();
      expect(session.dataset.counts).toEqual({ OPEN: 0, FIST: 0 });
      expect(session.trainer.model).toBeNull();
      expect(session.game.score).toBe(0);
      expect(session.getSnapshot().stage).toBe('START');
      expect(session.getSnapshot().settings).toEqual(defaults);
      expect(tf.memory().numTensors).toBe(initialTensors);
    }
  });
  it('cancels training before reset can publish an old model', async () => {
    const session = new SessionManager();
    const baseline = tf.memory().numTensors;
    for (let i = 0; i < config.minimumSamples; i++)
      for (const label of ['OPEN', 'FIST'] as const)
        session.dataset.add(
          label,
          new Float32Array(config.embeddingSize).fill(label === 'OPEN' ? 1 : -1),
        );
    const work = session.train();
    await session.resetSession();
    await work;
    expect(session.getSnapshot().stage).toBe('START');
    expect(session.trainer.model).toBeNull();
    expect(tf.memory().numTensors).toBe(baseline);
  });
  it('retains examples when adding a second person', () => {
    const session = new SessionManager();
    session.dataset.add('OPEN', new Float32Array(config.embeddingSize));
    session.improve();
    expect(session.dataset.counts.OPEN).toBe(1);
  });
  it('stops all camera tracks on reset', async () => {
    const session = new SessionManager();
    const stop = vi.fn();
    session.camera.stream = {
      getTracks: () => [{ stop, onended: null }],
    } as unknown as MediaStream;
    await session.resetSession();
    expect(stop).toHaveBeenCalledOnce();
    expect(session.camera.stream).toBeNull();
  });
});
