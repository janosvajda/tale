import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	agents,
	validateAgentSelection,
	validateDeploymentPreview,
} from './deployment.js';

test('deployment accepts supported entry points and rejects untrusted selections', () => {
	validateAgentSelection(
		agents.map((agent) => ({ agent: agent.id, location: 'auto' })),
	);
	for (const value of [
		[],
		null,
		[{ agent: 'unknown', location: 'auto' }],
		[{ agent: 'codex', location: '../AGENTS.md' }],
		[
			{ agent: 'codex', location: 'auto' },
			{ agent: 'codex', location: 'AGENTS.md' },
		],
	]) {
		assert.throws(() => validateAgentSelection(value));
	}
});
test('deployment previews validate across the renderer boundary', () => {
	const preview = {
		token: 'preview',
		target: '/project',
		taleExists: true,
		files: [
			{
				path: 'AGENTS.md',
				action: 'update',
				before: 'Old rule',
				content: 'Read the Tale',
			},
		],
		notes: [],
	};
	validateDeploymentPreview(preview);
	for (const patch of [
		{ taleExists: 'yes' },
		{
			files: [
				{ path: 'AGENTS.md', action: 'delete', before: null, content: '' },
			],
		},
		{ notes: [false] },
		{ token: null },
	]) {
		assert.throws(() => validateDeploymentPreview({ ...preview, ...patch }));
	}
});
