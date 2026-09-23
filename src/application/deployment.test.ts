import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseProject } from '../model/project.js';
import { createDeploymentChanges } from './deployment.js';

test('deployment content is independent from Electron and Chrome filesystems', async () => {
	const project = parseProject(await readFile('templates/blank.json', 'utf8'));
	const changes = await createDeploymentChanges(
		project,
		[{ agent: 'codex', location: 'AGENTS.md' }],
		'end',
		{
			read: async (path) => (path === 'AGENTS.md' ? 'Keep this.\n' : null),
			resolve: async (selected) => selected.location,
		},
	);
	assert.deepEqual(
		changes.changes.map((change) => change.path),
		['.tale/project.tale', 'AGENTS.md'],
	);
	assert.match(changes.changes[1]?.after ?? '', /Keep this\./);
	assert.match(changes.changes[1]?.after ?? '', /tale:project:start/);
});
