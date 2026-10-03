export type Gesture = 'OPEN' | 'FIST';
export type Stage =
  | 'START'
  | 'LOADING'
  | 'OPEN'
  | 'FIST'
  | 'READY'
  | 'TRAINING'
  | 'TRAINED'
  | 'TEST'
  | 'GAME'
  | 'RESULT'
  | 'PARTNER'
  | 'END';
export interface Prediction {
  open: number;
  fist: number;
  gesture: Gesture | null;
  latency: number;
  fps: number;
}
export interface SampleCounts {
  OPEN: number;
  FIST: number;
}
