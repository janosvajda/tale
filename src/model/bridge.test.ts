import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateReply } from './bridge.js';

test('bridge validates cancellations, errors and message types before UI use', () => {
	validateReply({ ok: true, cancelled: true });
	validateReply({
		ok: true,
		recentProjects: ['/project/one.json', '/project/two.json'],
	});
	validateReply({
		ok: true,
		directory: '/selected/project',
		templates: [{ id: 'blank.json', name: 'Blank' }],
	});
	validateReply({ ok: false, error: 'Unable to save' });
	for (const value of [
		null,
		{ ok: true, directory: 4 },
		{ ok: true, directory: 'a\0b' },
		{ ok: true, templates: {} },
		{ ok: true, recentProjects: ['same.json', 'same.json'] },
		{ ok: true, templates: [{ id: 'x', name: null }] },
		{ ok: true, cancelled: 'yes' },
		{ ok: false, error: 42 },
		{ ok: true, message: {} },
	])
		assert.throws(() => validateReply(value));
});
