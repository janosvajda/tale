import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { parseProject } from '../model/project.js';
import { createBaseline, digest } from './verifier.js';

test('CLI requires an external pinned approval and returns nonzero for failed evidence', async (t) => {
	const target = await mkdtemp(join(tmpdir(), 'tale-cli-target-'));
	const trusted = await mkdtemp(join(tmpdir(), 'tale-cli-trusted-'));
	t.after(() =>
		Promise.all([
			rm(target, { recursive: true, force: true }),
			rm(trusted, { recursive: true, force: true }),
		]),
	);
	const project = parseProject(
		await readFile('project/tale.project.json', 'utf8'),
	);
	project.diagram.items = project.diagram.items.filter(
		(item) => !['no-project-json', 'preserve-project'].includes(item.id),
	);
	project.diagram.connections = project.diagram.connections.filter(
		(edge) =>
			project.diagram.items.some((item) => item.id === edge.from) &&
			project.diagram.items.some((item) => item.id === edge.to),
	);
	const requirement = project.diagram.items.find(
		(item) => item.id === 'deployment-bytes',
	);
	const check = project.diagram.items.find(
		(item) => item.id === 'deploy-check',
	);
	assert.ok(requirement && check);
	requirement.properties.condition = 'exists';
	requirement.properties.subject = 'result.txt';
	check.properties.arguments = ['adapter.cjs'];
	check.properties.protected_files = ['adapter.cjs'];
	await writeFile(
		join(target, 'adapter.cjs'),
		"if(require('node:fs').existsSync('allow'))require('node:fs').writeFileSync('result.txt','yes');",
	);
	const projectPath = join(target, 'project.json');
	await writeFile(projectPath, JSON.stringify(project));
	const baseline = await createBaseline(target, project, 'CLI fixture');
	const baselinePath = join(trusted, 'approval.json');
	await writeFile(baselinePath, JSON.stringify(baseline));
	const args = [
		resolve('dist/node/src/runner/cli.js'),
		'verify',
		projectPath,
		target,
		baselinePath,
		digest(JSON.stringify(baseline)),
	];
	const invoke = () => spawnSync(process.execPath, args, { encoding: 'utf8' });
	const missing = invoke();
	assert.equal(missing.status, 1, missing.stderr);
	assert.equal(JSON.parse(missing.stdout).passed, false);
	await writeFile(join(target, 'allow'), '');
	const success = invoke();
	assert.equal(success.status, 0, success.stderr);
	args[args.length - 1] = 'untrusted';
	assert.equal(invoke().status, 1);
});
