import assert from 'node:assert/strict';
import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	symlink,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type TestContext, test } from 'node:test';
import { type AgentSelection, agents } from '../model/deployment.js';
import { parseProject } from '../model/project.js';
import { commitDeployment, prepareDeployment } from './deployment.js';
import { atomicWrite } from './files.js';

const codex: AgentSelection[] = [{ agent: 'codex', location: 'auto' }];
async function fixture(t: TestContext) {
	const root = await mkdtemp(join(tmpdir(), 'tale-deployment-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const project = parseProject(await readFile('tale.project.json', 'utf8'));
	return { root, project };
}
test('preview writes nothing; deploy creates selected entry points and preserves other Tale files', async (t) => {
	const { root, project } = await fixture(t);
	const selection = agents.map((agent) => ({
		agent: agent.id,
		location: 'auto',
	}));
	const plan = await prepareDeployment(root, project, selection);
	assert.deepEqual(await readdir(root), []);
	assert.equal(plan.preview.taleExists, false);
	await commitDeployment(plan, false);
	assert.equal(
		await readFile(join(root, '.tale/project.tale'), 'utf8'),
		await readFile('.tale/project.tale', 'utf8'),
	);
	assert.deepEqual(await readdir(join(root, '.tale')), ['project.tale']);
	assert.ok(plan.preview.files.every((file) => !file.path.endsWith('.json')));
	for (const file of plan.preview.files)
		assert.equal(await readFile(join(root, file.path), 'utf8'), file.content);
	assert.match(
		await readFile(join(root, 'CLAUDE.md'), 'utf8'),
		/@\.tale\/project.tale/,
	);
	assert.ok(
		(await readFile(join(root, '.cursor/rules/tale.mdc'), 'utf8')).startsWith(
			'---\nalwaysApply: true\n---\n',
		),
	);
	assert.ok(
		(await readFile(join(root, '.devin/rules/tale.md'), 'utf8')).startsWith(
			'---\ntrigger: always_on\n---\n',
		),
	);
	await writeFile(join(root, '.tale/keep.tale'), 'User rules');
	const again = await prepareDeployment(root, project, selection);
	assert.ok(again.preview.files.every((file) => file.action === 'unchanged'));
	await assert.rejects(commitDeployment(again, false), /Confirm overwriting/);
	await commitDeployment(again, true);
	assert.equal(
		await readFile(join(root, '.tale/keep.tale'), 'utf8'),
		'User rules',
	);
});
test('existing instructions retain content, case and Codex override precedence', async (t) => {
	const { root, project } = await fixture(t);
	await writeFile(join(root, 'agents.md'), 'User rules\r\n');
	const lower = await prepareDeployment(root, project, codex);
	assert.ok(
		lower.preview.notes.some((note) => note.includes('case-sensitive')),
	);
	await commitDeployment(lower, false);
	assert.ok(
		(await readFile(join(root, 'agents.md'), 'utf8')).startsWith(
			'User rules\r\n',
		),
	);
	await writeFile(join(root, 'AGENTS.override.md'), 'Active instructions\n');
	const override = await prepareDeployment(root, project, codex);
	assert.ok(
		override.preview.files.some((file) => file.path === 'AGENTS.override.md'),
	);
	assert.ok(!override.preview.files.some((file) => file.path === 'agents.md'));
});
test('Claude nested imports preserve CRLF; Gemini respects project-local custom names', async (t) => {
	const { root, project } = await fixture(t);
	await mkdir(join(root, '.claude'));
	await writeFile(join(root, '.claude/CLAUDE.md'), 'Existing instructions\r\n');
	await mkdir(join(root, '.gemini'));
	const settings = '{"context":{"fileName":["TEAM.md","GEMINI.md"]}}';
	await writeFile(join(root, '.gemini/settings.json'), settings);
	const plan = await prepareDeployment(root, project, [
		{ agent: 'claude', location: 'auto' },
		{ agent: 'gemini', location: 'auto' },
	]);
	await commitDeployment(plan, false);
	const claude = await readFile(join(root, '.claude/CLAUDE.md'), 'utf8');
	assert.ok(claude.includes('\r\n@../.tale/project.tale\r\n'));
	assert.ok(!claude.replaceAll('\r\n', '').includes('\n'));
	assert.ok(plan.preview.files.some((file) => file.path === 'TEAM.md'));
	assert.equal(
		await readFile(join(root, '.gemini/settings.json'), 'utf8'),
		settings,
	);
});
test('shared instruction paths are updated once and existing activation headers are preserved', async (t) => {
	const { root, project } = await fixture(t);
	const shared = await prepareDeployment(root, project, [
		...codex,
		{ agent: 'cursor', location: 'AGENTS.md' },
		{ agent: 'cline', location: 'AGENTS.md' },
	]);
	assert.deepEqual(
		shared.preview.files.map((file) => file.path),
		['.tale/project.tale', 'AGENTS.md'],
	);
	await mkdir(join(root, '.cursor/rules'), { recursive: true });
	const path = join(root, '.cursor/rules/tale.mdc');
	const header =
		'---\ndescription: User description\nalwaysApply: true\n---\nUser content\n';
	await writeFile(path, header);
	const selection: AgentSelection[] = [{ agent: 'cursor', location: 'auto' }];
	const plan = await prepareDeployment(root, project, selection);
	await commitDeployment(plan, false);
	assert.ok((await readFile(path, 'utf8')).startsWith(header));
	await writeFile(
		path,
		header.replace('alwaysApply: true', 'alwaysApply: false'),
	);
	await assert.rejects(
		prepareDeployment(root, project, selection),
		/not always active/,
	);
	assert.equal(
		await readFile(path, 'utf8'),
		header.replace('alwaysApply: true', 'alwaysApply: false'),
	);
});
test('changed targets and symbolic instruction directories are rejected before writes', async (t) => {
	const { root, project } = await fixture(t);
	const plan = await prepareDeployment(root, project, codex);
	await writeFile(join(root, 'AGENTS.md'), 'Concurrent edit');
	await assert.rejects(commitDeployment(plan, false), /target changed/);
	assert.deepEqual(await readdir(root), ['AGENTS.md']);
	const outside = await mkdtemp(join(tmpdir(), 'tale-outside-'));
	t.after(() => rm(outside, { recursive: true, force: true }));
	await symlink(outside, join(root, '.cursor'), 'dir');
	await assert.rejects(
		prepareDeployment(root, project, [{ agent: 'cursor', location: 'auto' }]),
		/real directory/,
	);
	assert.deepEqual(await readdir(outside), []);
});
test('write failures roll back created directories and prior instruction updates', async (t) => {
	const { root, project } = await fixture(t);
	await writeFile(join(root, 'AGENTS.md'), 'Original rules');
	const plan = await prepareDeployment(root, project, [
		...codex,
		{ agent: 'claude', location: 'auto' },
	]);
	await assert.rejects(
		commitDeployment(plan, false, async (path, content) => {
			if (path.endsWith('CLAUDE.md')) throw new Error('Disk failure');
			await atomicWrite(path, content);
		}),
		/Disk failure/,
	);
	assert.deepEqual(await readdir(root), ['AGENTS.md']);
	assert.equal(
		await readFile(join(root, 'AGENTS.md'), 'utf8'),
		'Original rules',
	);
});

test('all configured Tale outputs deploy deterministically with exact agent references', async (t) => {
	const { root, project } = await fixture(t);
	project.exports.push({
		id: 'additional',
		rootItemId: 'project',
		environmentId: null,
		path: '.tale/team/rules.tale',
	});
	const selection: AgentSelection[] = [
		{ agent: 'claude', location: '.claude/CLAUDE.md' },
	];
	const plan = await prepareDeployment(root, project, selection);
	await commitDeployment(plan, false);
	const expected = await readFile('.tale/project.tale');
	for (const output of project.exports)
		assert.deepEqual(await readFile(join(root, output.path)), expected);
	const instructions = await readFile(join(root, '.claude/CLAUDE.md'), 'utf8');
	assert.ok(
		instructions.includes('@../.tale/project.tale\n@../.tale/team/rules.tale'),
	);
	assert.ok(!instructions.includes('.json'));
	project.exports.reverse();
	const again = await prepareDeployment(root, project, selection);
	assert.deepEqual(
		again.preview.files,
		plan.preview.files.map((file) => ({ ...file, action: 'unchanged' })),
	);
	await commitDeployment(again, true);
	for (const output of project.exports)
		assert.deepEqual(await readFile(join(root, output.path)), expected);
});
test('invalid compilation or missing outputs cannot write deployment files', async (t) => {
	const { root, project } = await fixture(t);
	const goal = project.diagram.items.find((item) => item.id === 'goal');
	assert.ok(goal);
	goal.properties.unsupported = true;
	await assert.rejects(
		prepareDeployment(root, project, codex),
		/GOAL requires/,
	);
	assert.deepEqual(await readdir(root), []);
	project.exports = [];
	await assert.rejects(
		prepareDeployment(root, project, codex),
		/No Tale outputs/,
	);
	assert.deepEqual(await readdir(root), []);
});
test('redeployment replaces the old JSON loader while preserving user instructions', async (t) => {
	const { root, project } = await fixture(t);
	await writeFile(
		join(root, 'AGENTS.md'),
		'User instructions\n<!-- tale:project:start -->\nRead .tale/tale.project.json\n<!-- tale:project:end -->\nKeep this too\n',
	);
	await commitDeployment(await prepareDeployment(root, project, codex), false);
	const instructions = await readFile(join(root, 'AGENTS.md'), 'utf8');
	assert.ok(instructions.startsWith('User instructions\n'));
	assert.ok(instructions.endsWith('Keep this too\n'));
	assert.ok(instructions.includes('.tale/project.tale'));
	assert.ok(!instructions.includes('.json'));
	assert.deepEqual(await readdir(join(root, '.tale')), ['project.tale']);
});
