import { describe, expect, it } from 'vitest';
import { GestureController } from '../src/features/prediction/GestureController';
describe('GestureController', () => {
  function sequence(labels: string[]) {
    const controller = new GestureController();
    let jumps = 0;
    for (const label of labels)
      for (let frame = 0; frame < 2; frame++)
        if (controller.update(label === 'OPEN' ? 0.95 : 0.05, label === 'FIST' ? 0.95 : 0.05))
          jumps++;
    return jumps;
  }
  it('jumps once for stable OPEN -> FIST', () => expect(sequence(['OPEN', 'FIST'])).toBe(1));
  it('does not repeat while FIST is held', () =>
    expect(sequence(['OPEN', 'FIST', 'FIST', 'FIST'])).toBe(1));
  it('re-arms only after OPEN', () => expect(sequence(['OPEN', 'FIST', 'OPEN', 'FIST'])).toBe(2));
  it('ignores initial FIST', () => expect(sequence(['FIST', 'FIST'])).toBe(0));
  it('rejects uncertain and nonconsecutive samples', () => {
    const controller = new GestureController();
    controller.update(0.95, 0.05);
    controller.update(0.95, 0.05);
    expect(controller.update(0.3, 0.7)).toBe(false);
    expect(controller.update(0.1, 0.9)).toBe(false);
    expect(controller.update(0.4, 0.6)).toBe(false);
    expect(controller.update(0.1, 0.9)).toBe(false);
  });
  it('reset disarms and drops unfinished streaks', () => {
    const controller = new GestureController();
    controller.update(0.95, 0.05);
    controller.update(0.95, 0.05);
    controller.reset();
    expect(controller.update(0.05, 0.95)).toBe(false);
    expect(controller.update(0.05, 0.95)).toBe(false);
  });
  it('applies separate thresholds without a timer debounce', () => {
    const controller = new GestureController({
      openThreshold: 0.9,
      fistThreshold: 0.75,
      stableFrames: 2,
      inferenceHz: 15,
    });
    controller.update(0.85, 0.15);
    controller.update(0.85, 0.15);
    expect(controller.state).toBe('WAITING_FOR_OPEN');
    controller.update(0.95, 0.05);
    controller.update(0.95, 0.05);
    controller.update(0.2, 0.8);
    expect(controller.update(0.2, 0.8)).toBe(true);
  });
});
