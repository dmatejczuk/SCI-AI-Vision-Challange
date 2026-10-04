import * as tf from '@tensorflow/tfjs';
import { config } from '../../config/settings';
import { prepareInput, renderPreparedInput } from './preprocessing';
import type { ActivationLayer, PixelSource } from '../explanation/types';
export class FeatureExtractor {
  private base: tf.LayersModel | null = null;
  private features: tf.LayersModel | null = null;
  private activationView: tf.LayersModel | null = null;
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
  async extract(source: PixelSource): Promise<Float32Array> {
    return (await this.analyze(source)).featureVector;
  }
  async analyze(source: PixelSource, captureDetails = false) {
    if (!this.features || ('readyState' in source && (source.readyState < 2 || !source.videoWidth)))
      throw new Error('Camera or extractor not ready');
    const started = performance.now();
    const { input, metadata } = prepareInput(source);
    let embedding: tf.Tensor | undefined;
    try {
      // Only a requested snapshot reads input pixels back from the GPU.
      const inputValues = captureDetails ? Float32Array.from(await input.data()) : null;
      const preparedFrame = inputValues
        ? renderPreparedInput(inputValues, metadata.width, metadata.height)
        : null;
      const preparedAt = performance.now();
      embedding = tf.tidy(() => {
        const featureMap = this.features!.predict(input) as tf.Tensor4D;
        return featureMap.mean([1, 2]).reshape([config.embeddingSize]);
      });
      const featureVector = Float32Array.from(await embedding.data());
      return {
        featureVector,
        metadata,
        preparedFrame,
        inputValues,
        preprocessing: preparedAt - started,
        extraction: performance.now() - preparedAt,
      };
    } finally {
      input.dispose();
      embedding?.dispose();
    }
  }
  async inspectActivations(values: Float32Array, shape: number[]): Promise<ActivationLayer[]> {
    if (!this.base) throw new Error('Extractor not loaded');
    const names = ['conv_pw_1_relu', 'conv_pw_11_relu'];
    this.activationView ??= tf.model({
      inputs: this.base.inputs,
      outputs: names.map((name) => this.base!.getLayer(name).output as tf.SymbolicTensor),
    });
    const input = tf.tensor4d(values, shape as [number, number, number, number]);
    let outputs: tf.Tensor[] = [];
    try {
      outputs = this.activationView.predict(input) as tf.Tensor[];
      const layers: ActivationLayer[] = [];
      for (let index = 0; index < outputs.length; index++) {
        const output = outputs[index];
        const [, height, width, count] = output.shape as [number, number, number, number];
        const data = await output.data();
        const means = Array.from({ length: count }, (_, channel) => {
          let sum = 0;
          for (let pixel = 0; pixel < width * height; pixel++) sum += data[pixel * count + channel];
          return { index: channel, mean: sum / (width * height) };
        })
          .sort((a, b) => b.mean - a.mean || a.index - b.index)
          .slice(0, 8);
        layers.push({
          name: names[index],
          width,
          height,
          channels: means.map((channel) => ({
            ...channel,
            values: Float32Array.from(
              { length: width * height },
              (_, pixel) => data[pixel * count + channel.index],
            ),
          })),
        });
      }
      return layers;
    } finally {
      input.dispose();
      outputs.forEach((output) => output.dispose());
    }
  }
  dispose() {
    // The feature view reuses existing symbolic nodes, without retaining layers.
    // Only the original model owns their weights; disposing both double-frees them.
    this.activationView = null;
    this.features = null;
    this.base?.dispose();
    this.base = null;
  }
}
