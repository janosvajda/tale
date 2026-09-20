import assert from 'node:assert/strict';
import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseProject } from '../model/project.js';
import { VerificationSession } from './verification.js';

test('approval requires a human decision, invalidates changed contracts, and stays outside the project', async (t) => {
	const directory = await mkdtemp(join(tmpdir(), 'tale-approval-'));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const target = join(directory, 'project');
	const store = join(directory, 'trusted');
	await mkdir(join(target, 'scripts'), { recursive: true });
	await mkdir(join(target, '.tale'));
	const project = parseProject(await readFile('tale.project.json', 'utf8'));
	await writeFile(join(target, 'tale.project.json'), JSON.stringify(project));
	await writeFile(join(target, '.tale/project.tale'), 'approved');
	await writeFile(join(target, 'scripts/prove-deployment.mjs'), '');
	const session = new VerificationSession(store);
	const preview = await session.prepare(project, target);
	assert.equal(preview.approved, false);
	await assert.rejects(session.run(preview.token), /Approve/);
	assert.equal(
		await session.approve(preview.token, 'Review', () =>
			Promise.resolve(false),
		),
		null,
	);
	assert.deepEqual(await readdir(store), []);
	let details = '';
	const approval = await session.approve(
		preview.token,
		'Original acceptance criteria',
		(text) => {
			details = text;
			return Promise.resolve(true);
		},
	);
	assert.ok(approval?.approved);
	assert.ok(details.includes('scripts/prove-deployment.mjs'));
	assert.ok(details.includes('Previous approval: None'));
	assert.equal((await session.prepare(project, target)).approved, true);
	const rule = project.diagram.items.find(
		(item) => item.id === 'deployment-bytes',
	);
	assert.ok(rule);
	rule.properties.condition = 'exists';
	const changed = await session.prepare(project, target);
	assert.equal(changed.approved, false);
	assert.equal(changed.previousDigest, approval.digest);
	await assert.rejects(session.run(changed.token), /Approve/);
	await assert.rejects(
		new VerificationSession(join(target, 'approval')).prepare(project, target),
		/outside/,
	);
});
test('proof changes between review and approval cannot be silently approved', async (t) => {
	const dir = await mkdtemp(join(tmpdir(), 'tale-approval-race-'));
	t.after(() => rm(dir, { recursive: true, force: true }));
	const target = join(dir, 'project');
	await mkdir(target);
	const project = parseProject(await readFile('tale.project.json', 'utf8'));
	const check = project.diagram.items.find(
		(item) => item.id === 'deploy-check',
	);
	assert.ok(check);
	check.properties.protected_files = ['test.cjs'];
	for (const requirement of project.diagram.items.filter(
		(item) => item.typeId === 'requirement',
	)) {
		requirement.properties.condition = 'command_succeeds';
	}
	await writeFile(join(target, 'test.cjs'), 'before');
	const session = new VerificationSession(join(dir, 'trusted'));
	const preview = await session.prepare(project, target);
	await writeFile(join(target, 'test.cjs'), 'after');
	await assert.rejects(
		session.approve(preview.token, 'Review', () => Promise.resolve(true)),
		/changed during approval/,
	);
});
