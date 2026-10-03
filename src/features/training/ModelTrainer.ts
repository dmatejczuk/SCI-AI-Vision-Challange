import * as tf from '@tensorflow/tfjs';
import { config } from '../../config/settings';
import type { DatasetManager } from '../dataset/DatasetManager';
export class ModelTrainer {
  model: tf.Sequential | null = null;
  async train(dataset: DatasetManager, signal: AbortSignal, progress: (value: number) => void) {
    const data = dataset.balanced();
    const inputs = tf.tensor2d(data.values);
    const targets = tf.tidy(() => tf.oneHot(tf.tensor1d(data.labels, 'int32'), 2));
    const candidate = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [config.embeddingSize],
          units: 2,
          activation: 'softmax',
          kernelInitializer: 'glorotUniform',
        }),
      ],
    });
    const optimizer = tf.train.adam(0.008);
    candidate.compile({ optimizer, loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
    try {
      await candidate.fit(inputs, targets, {
        epochs: config.epochs,
        batchSize: 16,
        shuffle: true,
        yieldEvery: 'batch',
        callbacks: {
          onBatchEnd: async () => {
            if (signal.aborted) candidate.stopTraining = true;
          },
          onEpochEnd: async (epoch) => {
            if (!signal.aborted) progress((epoch + 1) / config.epochs);
          },
        },
      });
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      this.model?.dispose();
      this.model = candidate;
    } catch (error) {
      candidate.dispose();
      throw error;
    } finally {
      inputs.dispose();
      targets.dispose();
      optimizer.dispose();
    }
  }
  async predict(embedding: Float32Array) {
    if (!this.model) throw new Error('Classifier not trained');
    const output = tf.tidy(
      () => this.model!.predict(tf.tensor2d(embedding, [1, config.embeddingSize])) as tf.Tensor,
    );
    try {
      const values = await output.data();
      return { open: values[0], fist: values[1] };
    } finally {
      output.dispose();
    }
  }
  dispose() {
    this.model?.dispose();
    this.model = null;
  }
}
