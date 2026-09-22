import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSkill, skillCatalogue } from './skills.js';

test('prebuilt Skills contain only human-language text and no generic Skill entry', () => {
	assert.ok(skillCatalogue.length > 10);
	assert.ok(
		skillCatalogue.every(
			(entry) => entry.kind === 'skill' && entry.name !== 'Skill',
		),
	);
	assert.ok(
		skillCatalogue.every(
			(entry) =>
				typeof entry.defaultText === 'string' &&
				!('sections' in entry) &&
				!('properties' in entry),
		),
	);
	const created = createSkill('Team review');
	assert.equal(created.defaultText, '');
	assert.equal(created.name, 'Team review');
});
