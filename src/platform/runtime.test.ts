import assert from 'node:assert/strict';
import { test } from 'node:test';

test('platform runtime keeps Electron and Chrome adapters behind one bridge', async () => {
	const source = await import('node:fs/promises').then((fs) =>
		fs.readFile('src/platform/runtime.ts', 'utf8'),
	);
	assert.match(source, /window\.tale/);
	assert.match(source, /createChromeBridge/);
});
