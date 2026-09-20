const fixtureValues = {
	changedRunCount: 9,
};

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	availableFields,
	fieldChoices,
	initialValue,
	itemSummary,
	stepTemplate,
} from './fields.js';

test('readable summaries contain choices and prose rather than JSON', () => {
	assert.deepEqual(
		itemSummary({
			platforms: ['macOS', 'Windows'],
			editor: 'miro_style',
			preserve_user_changes: true,
		}),
		[
			'Supported platforms: macOS, Windows',
			'Editor style: Freeform board',
			'Preserve user changes: Yes',
		],
	);
	assert.deepEqual(itemSummary({ text: 'First line\nSecond line' }), [
		'First line',
		'Second line',
	]);
	assert.deepEqual(fieldChoices('SCOPE', 'mode', 'allow'), [
		'allow',
		'require_approval',
		'deny',
	]);
});
test('new rule defaults are independently editable and step types retain native data types', () => {
	const first = initialValue('DETERMINISM', 'rerun_check') as { runs: number };
	first.runs = fixtureValues.changedRunCount;
	assert.deepEqual(initialValue('DETERMINISM', 'rerun_check'), { runs: 2 });
	assert.deepEqual(stepTemplate('run'), {
		operation: 'run',
		command: '',
		expect: { exit: 0 },
		when: 'code_changed',
	});
	assert.ok(availableFields('TESTING').includes('test_pattern'));
});

test('summaries preserve literal commands and file paths', () => {
	assert.deepEqual(
		itemSummary({
			paths: ['src/my_module/**'],
			steps: [{ operation: 'run', command: 'npm run check_types' }],
		}),
		[
			'Files and folders: src/my_module/**',
			'Action: run · Command: npm run check_types',
		],
	);
});
