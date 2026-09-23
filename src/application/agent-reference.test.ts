import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	agentReference,
	hasUnmanagedTaleInstruction,
	withoutManagedReference,
} from './agent-reference.js';

test('agent references are deterministic, replaceable, and preserve other text', () => {
	const first = agentReference('Keep this.\n', 'Read .tale/project.tale.');
	const second = agentReference(first, 'Read .tale/project.tale.');
	assert.equal(second, first);
	assert.match(first, /tale:project:start/);
	assert.match(first, /Keep this\./);
	assert.equal(withoutManagedReference(first), 'Keep this.\n');
	assert.equal(
		hasUnmanagedTaleInstruction('Read .tale/project.tale before work.\n', [
			'.tale/project.tale',
		]),
		true,
	);
});
