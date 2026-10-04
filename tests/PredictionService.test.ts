import { describe, expect, it } from 'vitest';
import { PredictionService } from '../src/features/prediction/PredictionService';
import { abortable } from '../src/utils/abortable';
describe('Asynchronous cancellation', () => {
  it('does not schedule another inference after stopping an in-flight prediction', async () => {
    const service = new PredictionService();
    let resolve!: () => void;
    let calls = 0;
    service.start(
      () => {
        calls++;
        return new Promise<void>((done) => {
          resolve = done;
        });
      },
      () => 20,
      () => {},
    );
    await Promise.resolve();
    service.stop();
    resolve();
    await service.idle();
    await new Promise((done) => setTimeout(done, 70));
    expect(calls).toBe(1);
  });
  it('serializes a restarted loop behind the previous in-flight prediction', async () => {
    const service = new PredictionService();
    let release!: () => void;
    const order: string[] = [];
    service.start(
      async () => {
        order.push('first');
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        order.push('first finished');
      },
      () => 20,
      () => {},
    );
    await Promise.resolve();
    service.start(
      async () => {
        order.push('second');
      },
      () => 20,
      () => {},
    );
    await Promise.resolve();
    expect(order).toEqual(['first']);
    release();
    await service.idle();
    service.stop();
    expect(order).toEqual(['first', 'first finished', 'second']);
  });
  it('can cancel a pending camera permission without waiting for the user', async () => {
    const controller = new AbortController();
    const pending = abortable(new Promise<void>(() => {}), controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
