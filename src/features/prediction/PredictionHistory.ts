import type { Gesture } from '../../types';
export interface HistoryPoint {
  timestamp: number;
  open: number;
  fist: number;
  accepted: Gesture | null;
  jump: boolean;
  sentToGame: boolean;
  context: 'TEST' | 'GAME' | 'LAB';
  openThreshold: number;
  fistThreshold: number;
}
export class PredictionHistory {
  private buffer: (HistoryPoint | undefined)[] = new Array(90);
  private cursor = 0;
  add(point: HistoryPoint) {
    this.buffer[this.cursor] = point;
    this.cursor = (this.cursor + 1) % this.buffer.length;
  }
  read(now = Date.now()) {
    return this.buffer
      .filter((p): p is HistoryPoint => !!p && p.timestamp >= now - 3000 && p.timestamp <= now)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((p) => ({ ...p }));
  }
  clear() {
    this.buffer.fill(undefined);
    this.cursor = 0;
  }
}
