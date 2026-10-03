export const defaults = {
  fistThreshold: 0.8,
  openThreshold: 0.82,
  inferenceHz: 15,
  stableFrames: 2,
};
export type GestureSettings = typeof defaults;
export const config = {
  modelUrl: '/models/mobilenet/model.json',
  imageSize: 224,
  embeddingSize: 256,
  captureCount: 30,
  minimumSamples: 20,
  maximumSamples: 180,
  epochs: 24,
  captureInterval: 85,
  game: {
    width: 960,
    height: 480,
    ground: 388,
    gravity: 1500,
    jumpVelocity: -610,
    initialSpeed: 270,
    maxSpeed: 440,
    firstObstacleMs: 3600,
  },
};
