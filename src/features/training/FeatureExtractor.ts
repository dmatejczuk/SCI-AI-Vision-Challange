import * as tf from '@tensorflow/tfjs';
import { config } from '../../config/settings';
export class FeatureExtractor {
  private base: tf.LayersModel | null = null;
  private features: tf.LayersModel | null = null;
  async load(signal: AbortSignal) {
    if (this.base) return;
    try {
      await tf.setBackend('webgl');
    } catch {
      await tf.setBackend('cpu');
    }
    await tf.ready();
    const base = await tf.loadLayersModel(config.modelUrl, { requestInit: { signal } });
    if (signal.aborted) {
      base.dispose();
      throw new DOMException('Cancelled', 'AbortError');
    }
    try {
      this.base = base;
      this.features = tf.model({
        inputs: base.inputs,
        outputs: base.getLayer('conv_pw_13_relu').output,
      });
      const warmup = tf.tidy(() => {
        const result = this.features!.predict(
          tf.zeros([1, config.imageSize, config.imageSize, 3]),
        ) as tf.Tensor4D;
        return result.mean([1, 2]);
      });
      try {
        await warmup.data();
      } finally {
        warmup.dispose();
      }
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  async extract(video: HTMLVideoElement): Promise<Float32Array> {
    if (!this.features || video.readyState < 2 || !video.videoWidth)
      throw new Error('Camera or extractor not ready');
    const embedding = tf.tidy(() => {
      const pixels = tf.browser.fromPixels(video);
      const [height, width] = pixels.shape;
      const edge = Math.min(height, width);
      const crop = pixels.slice(
        [Math.floor((height - edge) / 2), Math.floor((width - edge) / 2), 0],
        [edge, edge, 3],
      );
      const resized = tf.image.resizeBilinear(crop, [config.imageSize, config.imageSize]);
      const input = resized.reverse(1).toFloat().div(127.5).sub(1).expandDims(0);
      const featureMap = this.features!.predict(input) as tf.Tensor4D;
      return featureMap.mean([1, 2]).reshape([config.embeddingSize]);
    });
    try {
      return Float32Array.from(await embedding.data());
    } finally {
      embedding.dispose();
    }
  }
  dispose() {
    // The feature view reuses existing symbolic nodes, without retaining layers.
    // Only the original model owns their weights; disposing both double-frees them.
    this.features = null;
    this.base?.dispose();
    this.base = null;
  }
}
