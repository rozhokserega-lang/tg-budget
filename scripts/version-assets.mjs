import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Run before publishing miniapp/. Changed assets receive a new cache key.
const root = fileURLToPath(new URL('../', import.meta.url));
const htmlPath = path.join(root, 'index.html');
const original = await readFile(htmlPath, 'utf8');
const assetPattern = /\b(href|src)="((?:styles|src)\/[^"?]+\.(?:css|js))(?:\?[^" ]*)?"/g;
const assets = [...new Set([...original.matchAll(assetPattern)].map(match => match[2]))];
if (!assets.length) throw new Error('No application assets found in index.html');

const versions = new Map();
const buildHash = createHash('sha256');
for (const asset of assets) {
  const content = await readFile(path.join(root, asset));
  const hash = createHash('sha256').update(content).digest('hex');
  versions.set(asset, hash.slice(0, 12));
  buildHash.update(asset).update('\0').update(hash).update('\0');
}
const build = buildHash.digest('hex').slice(0, 12);
let html = original.replace(assetPattern, (_, attr, asset) => `${attr}="${asset}?v=${versions.get(asset)}"`);
html = html.replace(/(<meta name="app-build" content=")[^"]*(">)/, `$1${build}$2`);
if (html !== original) await writeFile(htmlPath, html, 'utf8');
console.log(`Build ${build}: versioned ${assets.length} application assets.`);
