import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateReply } from './bridge.js';

test('bridge validates cancellations, errors and message types before UI use', () => {
	validateReply({ ok: true, cancelled: true });
	validateReply({ ok: false, error: 'Unable to save' });
	for (const value of [
		null,
		{ ok: true, cancelled: 'yes' },
		{ ok: false, error: 42 },
		{ ok: true, message: {} },
	])
		assert.throws(() => validateReply(value));
});
