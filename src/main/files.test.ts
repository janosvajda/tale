import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agentReference } from './files.js';

test('agent integration updates only its owned block', () => {
	const once = agentReference('User instructions\n');
	const userEdited = once + '\nMore user instructions\n';
	const twice = agentReference(userEdited);
	assert.equal(twice, userEdited);
	assert.ok(twice.endsWith('\nMore user instructions\n'));
});
