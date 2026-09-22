import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogue } from './catalogue.js';
import { newProject } from './new-project.js';
import { validateProject } from './project.js';

test('built-in Tags are human-language defaults with no form schema', () => {
	validateProject(newProject());
	assert.ok(catalogue.tags.length > 10);
	assert.ok(!catalogue.tags.some((entry) => entry.name === 'Editor'));
	assert.ok(
		catalogue.tags.every(
			(entry) =>
				entry.kind === 'tag' &&
				entry.defaultText.trim().length > 0 &&
				!/^Describe\b/i.test(entry.defaultText),
		),
	);
	assert.equal(
		new Set(catalogue.tags.map((entry) => entry.name.toLowerCase())).size,
		catalogue.tags.length,
	);
	assert.ok(
		catalogue.tags.every(
			(entry) =>
				!('fields' in entry) &&
				!('sections' in entry) &&
				!('properties' in entry),
		),
	);
	assert.match(
		catalogue.tags.find((entry) => entry.tag === 'CHANGES')?.defaultText ?? '',
		/Deny unrelated changes\./,
	);
	assert.match(
		catalogue.tags.find((entry) => entry.tag === 'APPROVAL_GATE')
			?.defaultText ?? '',
		/Wait for an explicit yes/,
	);
	assert.match(
		catalogue.tags.find((entry) => entry.tag === 'NO_BYPASSES')?.defaultText ??
			'',
		/Do not make a failing check green/,
	);
	assert.match(
		catalogue.tags.find((entry) => entry.name === 'Do not be silly')
			?.defaultText ?? '',
		/compare the result with the user's actual request/,
	);
});
