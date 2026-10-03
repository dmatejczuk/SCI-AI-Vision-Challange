import { defaults, type GestureSettings } from '../../config/settings';
import type { Gesture } from '../../types';
export class GestureController {
  state: 'WAITING_FOR_OPEN' | 'ARMED' = 'WAITING_FOR_OPEN';
  private candidate: Gesture | null = null;
  private count = 0;
  constructor(public settings: GestureSettings = { ...defaults }) {}
  update(open: number, fist: number): boolean {
    const gesture: Gesture | null =
      open >= this.settings.openThreshold
        ? 'OPEN'
        : fist >= this.settings.fistThreshold
          ? 'FIST'
          : null;
    if (!gesture) {
      this.candidate = null;
      this.count = 0;
      return false;
    }
    this.count = this.candidate === gesture ? this.count + 1 : 1;
    this.candidate = gesture;
    if (this.count < this.settings.stableFrames) return false;
    if (gesture === 'OPEN') this.state = 'ARMED';
    if (gesture === 'FIST' && this.state === 'ARMED') {
      this.reset();
      return true;
    }
    return false;
  }
  reset() {
    this.state = 'WAITING_FOR_OPEN';
    this.candidate = null;
    this.count = 0;
  }
}
