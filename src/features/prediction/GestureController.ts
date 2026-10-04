import { defaults, type GestureSettings } from '../../config/settings';
import type { Gesture } from '../../types';
export interface GesturePreview {
  before: 'WAITING_FOR_OPEN' | 'ARMED';
  after: 'WAITING_FOR_OPEN' | 'ARMED';
  jump: boolean;
  stableFrames: number;
  candidateBefore: Gesture | null;
  countBefore: number;
  candidateAfter: Gesture | null;
  countAfter: number;
  fistThreshold: number;
  openThreshold: number;
}
export class GestureController {
  state: 'WAITING_FOR_OPEN' | 'ARMED' = 'WAITING_FOR_OPEN';
  private candidate: Gesture | null = null;
  private count = 0;
  constructor(public settings: GestureSettings = { ...defaults }) {}
  clone() {
    const copy = new GestureController({ ...this.settings });
    copy.state = this.state;
    copy.candidate = this.candidate;
    copy.count = this.count;
    return copy;
  }
  preview(open: number, fist: number): GesturePreview {
    // Evaluate one prediction on a copy; never arm or trigger the live controller.
    const copy = new GestureController({ ...this.settings });
    copy.state = this.state;
    copy.candidate = this.candidate;
    copy.count = this.count;
    const before = copy.state;
    const candidateBefore = copy.candidate,
      countBefore = copy.count;
    const jump = copy.update(open, fist);
    return {
      before,
      candidateBefore,
      countBefore,
      candidateAfter: copy.candidate,
      countAfter: copy.count,
      after: copy.state,
      jump,
      stableFrames: copy.settings.stableFrames,
      fistThreshold: copy.settings.fistThreshold,
      openThreshold: copy.settings.openThreshold,
    };
  }
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
