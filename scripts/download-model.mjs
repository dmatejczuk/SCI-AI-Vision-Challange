import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/';
const directory = new URL('../public/models/mobilenet/', import.meta.url);
await mkdir(directory, { recursive: true });
async function download(name) {
  const response = await fetch(new URL(name, base));
  if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(new URL(name, directory), bytes);
  return bytes;
}
const modelBytes = await download('model.json');
const model = JSON.parse(modelBytes);
const files = { 'model.json': createHash('sha256').update(modelBytes).digest('hex') };
for (const name of model.weightsManifest.flatMap((group) => group.paths)) {
  if (!/^[\w.-]+$/.test(name)) throw new Error('Unexpected weight path');
  files[name] = createHash('sha256')
    .update(await download(name))
    .digest('hex');
}
await writeFile(new URL('checksums.json', directory), JSON.stringify(files, null, 2) + '\n');
console.info('Downloaded and checksummed MobileNet v1 0.25/224.');
