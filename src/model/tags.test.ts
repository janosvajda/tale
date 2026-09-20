import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	defaults,
	directives,
	tags,
	unusedTagColor,
	validTag,
} from './tags.js';

test('all palette tags have safe independent defaults and directive orders contain no duplicates', () => {
	assert.equal(new Set(tags).size, tags.length);
	for (const tag of tags) {
		const first = defaults(tag);
		first.changed = true;
		assert.equal(defaults(tag).changed, undefined);
	}
	for (const order of Object.values(directives))
		assert.equal(new Set(order).size, order.length);
	assert.deepEqual(defaults('PROOF'), { steps: [] });
	assert.deepEqual(defaults('SCOPE'), { mode: 'allow', paths: [] });
});

test('custom tags have safe identifiers and new types get distinct colours', () => {
	for (const tag of [...tags, 'TEAM_RULES', 'ACCESSIBILITY_2'])
		assert.ok(validTag(tag));
	for (const tag of [
		'',
		'lowercase',
		'2TEAM',
		'TEAM RULES',
		'TEAM\nPROOF',
		'__proto__',
	])
		assert.equal(validTag(tag), false);
	const colours = ['#475569', '#58779c'];
	const next = unusedTagColor(colours);
	assert.ok(!colours.map((colour) => colour.toUpperCase()).includes(next));
	assert.equal(unusedTagColor(colours), next);
	assert.deepEqual(defaults('TEAM_RULES'), {});
});
