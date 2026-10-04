import { useMemo, useState } from 'react';
import { pl } from '../../i18n/pl';
import type { InferenceSnapshot } from './types';
import { Frame } from './PixelInspector';
import { tensorPixel } from './labMath';
const t = pl.explanation;
export function TensorInspector({ snapshot }: { snapshot: InferenceSnapshot }) {
  const m = snapshot.inputMetadata;
  const [selected, setSelected] = useState({
    x: Math.floor(m.width / 2),
    y: Math.floor(m.height / 2),
  });
  const planes = useMemo(
    () =>
      [0, 1, 2].map((channel) => {
        const data = new Uint8ClampedArray(m.width * m.height * 4);
        for (let i = 0; i < m.width * m.height; i++) {
          data[i * 4 + channel] =
            (snapshot.inputValues[i * 3 + channel] - m.normalization.offset) *
            m.normalization.divisor;
          data[i * 4 + 3] = 255;
        }
        return new ImageData(data, m.width, m.height);
      }),
    [m, snapshot.inputValues],
  );
  return (
    <>
      <div className="tensor-shape">
        <code>[{m.shape.join(', ')}]</code>
        <dl>
          {m.shape.map((value, i) => (
            <div key={i}>
              <dt>{value}</dt>
              <dd>{t.shapeLabels[i]}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="tensor-planes">
        {planes.map((plane, i) => (
          <Frame
            key={i}
            frame={plane}
            label={`${t.channel} ${'RGB'[i]}`}
            selected={selected}
            onSelect={setSelected}
          />
        ))}
      </div>
      <div className="tensor-readout">
        <strong>
          {t.tensorValue} [0, {selected.y}, {selected.x}, RGB]
        </strong>
        <code>
          {tensorPixel(snapshot.inputValues, m.width, selected.x, selected.y)
            .map((value, i) => `${'RGB'[i]} = ${value.toFixed(6)}`)
            .join(' · ')}
        </code>
      </div>
      <p className="lab-big-number">
        {m.shape.join(' × ')} ={' '}
        <b>
          {m.shape.reduce((product, dimension) => product * dimension, 1).toLocaleString('pl-PL')}{' '}
          {t.values}
        </b>
      </p>
      <p>{t.tensorHelp}</p>
    </>
  );
}
