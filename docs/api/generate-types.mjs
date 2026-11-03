#!/usr/bin/env node
// Генерация TypeScript-типов из OpenAPI 3.1.
// Использование:
//   node docs/api/generate-types.mjs                    # -> docs/api/api-types.d.ts
//   node docs/api/generate-types.mjs src/api-types.d.ts # -> src/api-types.d.ts
// Требуется сеть при первом запуске (npx скачивает openapi-typescript@7).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const input = resolve(root, 'docs/api/openapi.v1.yaml');
const output = resolve(root, process.argv[2] ?? 'docs/api/api-types.d.ts');

if (!existsSync(input)) {
  console.error(`OpenAPI not found: ${input}`);
  process.exit(1);
}
mkdirSync(dirname(output), { recursive: true });

console.log(`openapi: ${input}`);
console.log(`types:   ${output}`);
execFileSync('npx', ['-y', 'openapi-typescript@7', input, '-o', output], {
  stdio: 'inherit',
  cwd: root,
});
