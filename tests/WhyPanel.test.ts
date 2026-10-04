import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WhyPanel, WhySummary } from '../src/features/explanation/WhyPanel';
import { SessionManager } from '../src/services/SessionManager';
import type { InferenceSnapshot } from '../src/features/explanation/types';
import { interpretScores } from '../src/features/prediction/InferencePipeline';
import { defaults } from '../src/config/settings';
function fixture(open: number, fist: number) {
  const session = new SessionManager();
  const frame = {
    width: 1,
    height: 1,
    data: new Uint8ClampedArray([0, 128, 255, 255]),
  } as ImageData;
  const snapshot: InferenceSnapshot = {
    id: 1,
    timestamp: 0,
    modelRevision: 1,
    sourceFrame: frame,
    preparedFrame: frame,
    inputMetadata: {
      sourceWidth: 1,
      sourceHeight: 1,
      crop: { left: 0, top: 0, size: 1 },
      width: 1,
      height: 1,
      mirrored: true,
      shape: [1, 1, 1, 3],
      normalization: { divisor: 127.5, offset: -1 },
      normalizedRange: [-1, 1],
    },
    featureVector: new Float32Array(256),
    inputValues: new Float32Array(3),
    histogram: [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)],
    history: [],
    trainingMeans: null,
    pca: null,
    activations: null,
    samples: { OPEN: 30, FIST: 30 },
    classScores: { open, fist },
    ...interpretScores({ open, fist }, defaults),
    gesturePreview: session.gestures.preview(open, fist),
    timings: { preprocessing: 0, extraction: 0, classification: 0, total: 0 },
  };
  return { session, snapshot };
}
describe('Evidence-based classroom explanations', () => {
  it('distinguishes 54/46 ambiguity from a high-score result and does not claim a hand part', () => {
    const ambiguous = renderToStaticMarkup(
      createElement(WhyPanel, { ...fixture(0.54, 0.46), busy: false, progress: 0 }),
    );
    const confident = renderToStaticMarkup(
      createElement(WhyPanel, { ...fixture(0.02, 0.98), busy: false, progress: 0 }),
    );
    expect(ambiguous).toContain('Model nie jest pewny');
    expect(ambiguous).toContain('podobne wyniki');
    expect(confident).not.toContain('Model nie jest pewny');
    expect(confident).toContain('FIST');
    expect(confident).toContain('Nie wyszukuje najbliższego zdjęcia i nie używa PCA');
    expect(confident).not.toContain('wykrył zaciśnięte palce');
  });
  it('reports the actual threshold failure and explicitly separates preview from game actions', () => {
    const { snapshot } = fixture(0.54, 0.46);
    const html = renderToStaticMarkup(createElement(WhySummary, { snapshot }));
    expect(html).toContain('54.00');
    expect(html).toContain('82');
    expect(html).toContain('Ta analiza nie wykonała skoku w grze');
    expect(html).toContain('WAITING_FOR_OPEN');
  });
});
