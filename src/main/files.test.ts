import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	agentReference,
	hasUnmanagedTaleInstruction,
	withoutManagedReference,
} from './files.js';

test('agent integration updates only its owned block', () => {
	const once = agentReference('User instructions\n');
	const userEdited = once + '\nMore user instructions\n';
	const twice = agentReference(userEdited);
	assert.equal(twice, userEdited);
	assert.ok(twice.endsWith('\nMore user instructions\n'));
});
test('new Tale reference can lead an agent file without displacing its activation header', () => {
	const beginning = agentReference(
		'User instructions\n',
		undefined,
		'beginning',
	);
	assert.ok(beginning.startsWith('<!-- tale:project:start -->'));
	assert.ok(beginning.endsWith('User instructions\n'));
	const withHeader = agentReference(
		'---\nalwaysApply: true\n---\nUser instructions\n',
		undefined,
		'beginning',
	);
	assert.ok(
		withHeader.startsWith(
			'---\nalwaysApply: true\n---\n<!-- tale:project:start -->',
		),
	);
	assert.ok(withHeader.endsWith('User instructions\n'));
});
test('an existing unmarked Tale instruction is preserved without a second managed reference', () => {
	const original = 'Read .tale/project.tale before editing. Keep this rule.\n';
	const duplicate = agentReference(original);
	assert.equal(
		hasUnmanagedTaleInstruction(duplicate, ['.tale/project.tale']),
		true,
	);
	assert.equal(withoutManagedReference(duplicate), original);
	assert.equal(
		hasUnmanagedTaleInstruction('```\nRead .tale/project.tale\n```\n', [
			'.tale/project.tale',
		]),
		false,
	);
});
