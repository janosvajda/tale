import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const tests = [];
for (const root of ['src', 'tests']) {
  for (const path of await readdir(root, { recursive: true })) {
    if (!path.endsWith('.test.ts') || path.endsWith('.e2e.test.ts')) continue;
    if ((await readFile(`${root}/${path}`, 'utf8')).startsWith('// @browser-test')) continue;
    tests.push(`dist/node/${root}/${path.slice(0, -3)}.js`);
  }
}
const result = spawnSync(process.execPath, ['--test', ...tests.sort(), 'scripts/test-pairs.test.mjs'], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
