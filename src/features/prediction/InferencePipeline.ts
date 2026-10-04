import type { FeatureExtractor } from '../training/FeatureExtractor';
import type { ModelTrainer } from '../training/ModelTrainer';
import type { ClassScores, PixelSource } from '../explanation/types';
import type { GestureSettings } from '../../config/settings';
import type { Gesture } from '../../types';

export function interpretScores(scores: ClassScores, settings: GestureSettings) {
  const predictedClass: Gesture = scores.open >= scores.fist ? 'OPEN' : 'FIST';
  const confidence = Math.max(scores.open, scores.fist);
  const acceptedGesture: Gesture | null =
    scores.open >= settings.openThreshold
      ? 'OPEN'
      : scores.fist >= settings.fistThreshold
        ? 'FIST'
        : null;
  return { predictedClass, confidence, acceptedGesture };
}

export class InferencePipeline {
  constructor(
    private extractor: FeatureExtractor,
    private classifier: ModelTrainer,
  ) {}
  async predict(source: PixelSource, settings: GestureSettings, captureDetails = false) {
    const started = performance.now();
    const features = await this.extractor.analyze(source, captureDetails);
    const classificationStarted = performance.now();
    const classScores = await this.classifier.predict(features.featureVector);
    return {
      ...features,
      classScores,
      ...interpretScores(classScores, settings),
      timings: {
        preprocessing: features.preprocessing,
        extraction: features.extraction,
        classification: performance.now() - classificationStarted,
        total: performance.now() - started,
      },
    };
  }
}
