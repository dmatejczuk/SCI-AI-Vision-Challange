import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../public/models/mobilenet/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('checksums.json', root), 'utf8'));
const model = JSON.parse(await readFile(new URL('model.json', root), 'utf8'));
for (const name of ['model.json', ...model.weightsManifest.flatMap((group) => group.paths)]) {
  const actual = createHash('sha256')
    .update(await readFile(new URL(name, root)))
    .digest('hex');
  if (actual !== manifest[name]) throw new Error(`Model integrity failure: ${name}`);
}
console.info('Local model integrity verified.');
