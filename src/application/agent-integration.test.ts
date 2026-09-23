import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	activateAgentFile,
	agentInstructions,
	resolveAgentLocation,
	safeRelativePath,
} from './agent-integration.js';

test('agent integration content is shared across deployment platforms', async () => {
	assert.equal(
		activateAgentFile('.cursor/rules/tale.mdc', ''),
		'---\nalwaysApply: true\n---\n',
	);
	const instructions = agentInstructions(
		'CLAUDE.md',
		[{ agent: 'claude', location: 'CLAUDE.md' }],
		['.tale/project.tale'],
		[{ id: 'production', name: 'Production' }],
	);
	assert.match(instructions, /read "\.tale\/project\.tale"/);
	assert.match(instructions, /Production/);
	assert.match(instructions, /@\.tale\/project\.tale/);
	assert.equal(safeRelativePath('.github/copilot-instructions.md'), true);
	assert.equal(safeRelativePath('../outside.md'), false);
	assert.equal(
		await resolveAgentLocation(
			{ agent: 'codex', location: 'auto' },
			{
				read: async (path) => (path === 'AGENTS.md' ? 'Existing' : null),
				normalize: async (path) => path,
			},
		),
		'AGENTS.md',
	);
});
