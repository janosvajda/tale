import assert from 'node:assert/strict';
import { test } from 'node:test';
import { trustedSender } from './window.js';

test('IPC sender must match all three security boundaries', () => {
	const trusted = { url: 'file:///tale/index.html', webContentsId: 7 };
	const valid = { ...trusted, mainFrame: true };
	assert.equal(trustedSender(valid, trusted), true);
	for (const invalid of [
		{ ...valid, mainFrame: false },
		{ ...valid, url: 'file:///other.html' },
		{ ...valid, webContentsId: 8 },
	])
		assert.equal(trustedSender(invalid, trusted), false);
});
