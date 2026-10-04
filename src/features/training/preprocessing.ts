import * as tf from '@tensorflow/tfjs';
import { config } from '../../config/settings';
import type { InputMetadata, PixelSource } from '../explanation/types';

export const normalization = { divisor: 127.5, offset: -1 } as const;
export const normalizePixel = (value: number) =>
  value / normalization.divisor + normalization.offset;

// Shared by collection, live inference and the frozen-frame explanation.
export function prepareInput(source: PixelSource): { input: tf.Tensor4D; metadata: InputMetadata } {
  return tf.tidy(() => {
    const pixels = tf.browser.fromPixels(source);
    const [height, width] = pixels.shape;
    const size = Math.min(height, width);
    const left = Math.floor((width - size) / 2),
      top = Math.floor((height - size) / 2);
    const crop = pixels.slice([top, left, 0], [size, size, 3]);
    const resized = tf.image.resizeBilinear(crop, [config.imageSize, config.imageSize]);
    const input = resized
      .reverse(1)
      .toFloat()
      .div(normalization.divisor)
      .add(normalization.offset)
      .expandDims(0) as tf.Tensor4D;
    return {
      input,
      metadata: {
        sourceWidth: width,
        sourceHeight: height,
        crop: { left, top, size },
        width: config.imageSize,
        height: config.imageSize,
        mirrored: true as const,
        shape: [...input.shape],
        normalization: { ...normalization },
        normalizedRange: [-1, 1] as const,
      },
    };
  });
}

export function renderPreparedInput(
  values: Float32Array,
  width: number,
  height: number,
): ImageData {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index++) {
    for (let channel = 0; channel < 3; channel++)
      pixels[index * 4 + channel] = Math.round(
        (values[index * 3 + channel] - normalization.offset) * normalization.divisor,
      );
    pixels[index * 4 + 3] = 255;
  }
  return new ImageData(pixels, width, height);
}
