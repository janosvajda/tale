import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { missingTestPairs } from './test-pairs.mjs';

test('test-pair gate fails for missing siblings and accepts paired files without recursive test requirements', async () => {
 const root = await mkdtemp(join(tmpdir(), 'tale-pairs-'));
 try {
  await mkdir(join(root, 'nested'));
  await writeFile(join(root, 'nested/entry.ts'), '');
  assert.deepEqual(await missingTestPairs(root), [join('nested', 'entry.test.ts')]);
  await writeFile(join(root, 'nested/entry.test.ts'), '');
  assert.deepEqual(await missingTestPairs(root), []);
  await mkdir(join(root, 'dist'));
  await writeFile(join(root, 'dist/generated.ts'), '');
  assert.deepEqual(await missingTestPairs(root), []);
 } finally { await rm(root, { recursive: true, force: true }); }
});
