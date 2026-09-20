import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

test('closing the last window quits on every platform', async () => {
	let quits = 0;
	const app = Object.assign(new EventEmitter(), {
		quit: () => {
			quits++;
		},
	});
	const exports: { quitWhenWindowsClose?: () => void } = {};
	runInNewContext(await readFile('dist/node/src/main/lifecycle.js', 'utf8'), {
		exports,
		require: () => ({ app }),
	});
	exports.quitWhenWindowsClose?.();
	assert.equal(quits, 0);
	app.emit('window-all-closed');
	assert.equal(quits, 1);
});
