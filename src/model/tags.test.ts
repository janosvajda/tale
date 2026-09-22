import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogue } from './catalogue.js';
import { generatedTag, nameAvailable, unusedColor } from './tags.js';

test('custom Tag names remain unique while identifiers stay internal', () => {
	assert.equal(nameAvailable(' changes ', catalogue.tags), false);
	assert.equal(generatedTag('Team rules', catalogue.tags), 'TEAM_RULES');
	assert.equal(generatedTag('Changes', catalogue.tags), 'CHANGES_2');
	assert.match(unusedColor(catalogue.tags), /^#[0-9A-F]{6}$/);
});
