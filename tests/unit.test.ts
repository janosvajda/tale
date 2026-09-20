import { commitDeployment, prepareDeployment } from '../src/main/deployment.js';

const fixtureValues = {
	epsilon: 1e-10,
	layoutOffset: 731,
	oversizedBytes: 8_000_001,
	zoomFactor: 1.8,
};

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
import { after, test } from 'node:test';
import { compile } from '../src/application/compiler.js';
import { agentReference, atomicWrite, exportTales } from '../src/main/files.js';
import { trustedSender } from '../src/main/window.js';
import { validateReply } from '../src/model/bridge.js';
import {
	type Project,
	parseProject,
	serializeProject,
	validateProject,
} from '../src/model/project.js';
import { boundary, world, zoomAt } from '../src/svg/geometry.js';

const directories: string[] = [];
after(async () => {
	for (const directory of directories)
		await rm(directory, { recursive: true, force: true });
});
async function temporary() {
	const dir = await mkdtemp(join(tmpdir(), 'tale-test-'));
	directories.push(dir);
	return dir;
}
async function fixture(): Promise<Project> {
	return parseProject(await readFile('project/tale.project.json', 'utf8'));
}

async function deployProject(target: string, project: Project) {
	const plan = await prepareDeployment(target, project, [
		{ agent: 'codex', location: 'auto' },
	]);
	await commitDeployment(plan, true);
}
test('compiles the independently authored Tale exactly, without mutating input', async () => {
	const project = await fixture();
	const before = serializeProject(project);
	const expected = await readFile('.tale/project.tale');
	const artifact = compile(project)[0];
	assert.ok(artifact);
	assert.deepEqual(Buffer.from(artifact.content), expected);
	assert.equal(serializeProject(project), before);
});
test('key order, layout, titles, and type colours cannot change compiled bytes', async () => {
	const project = await fixture();
	const expected = compile(project);
	project.diagram.items.reverse();
	project.diagram.connections.reverse();
	for (const item of project.diagram.items) {
		item.title = 'A different title';
		item.position.x += fixtureValues.layoutOffset;
		item.properties = Object.fromEntries(
			Object.entries(item.properties).reverse(),
		);
	}
	project.diagram.viewport = { x: 500, y: -72, zoom: 0.3 };
	assert.deepEqual(compile(project), expected);
});
test('cycles and unknown relationships survive JSON but fail compilation explicitly', async () => {
	const project = await fixture();
	project.diagram.connections.push({
		id: 'loop',
		from: 'goal',
		to: 'project',
		kind: 'contains',
		order: 0,
	});
	assert.equal(
		parseProject(serializeProject(project)).diagram.connections.at(-1)?.id,
		'loop',
	);
	assert.throws(() => compile(project), /no defined Tale compilation/);
	project.diagram.connections.pop();
	const first = project.diagram.connections[0];
	assert.ok(first);
	first.kind = 'unknown';
	assert.throws(() => compile(project), /Undefined compilation/);
});
test('rejects ambiguous outputs and missing required sections', async () => {
	const project = await fixture();
	const output = project.exports[0];
	assert.ok(output);
	project.exports.push({ ...output, id: 'second' });
	assert.throws(() => compile(project), /Choose one Tale/);
	project.exports.pop();
	project.diagram.connections = project.diagram.connections.filter(
		(e) => e.to !== 'goal',
	);
	assert.throws(() => compile(project), /Missing GOAL/);
});
test('validation rejects malformed geometry, dangling IDs, duplicate IDs, traversal and oversized projects', async () => {
	for (const corrupt of [
		(p: Project) => {
			p.diagram.viewport.zoom = 0;
		},
		(p: Project) => {
			const item = p.diagram.items[0];
			assert.ok(item);
			p.diagram.items.push(item);
		},
		(p: Project) => {
			const edge = p.diagram.connections[0];
			assert.ok(edge);
			edge.to = 'missing';
		},
		(p: Project) => {
			const output = p.exports[0];
			assert.ok(output);
			output.path = '.tale/../../outside.tale';
		},
	]) {
		const p = await fixture();
		corrupt(p);
		assert.throws(() => validateProject(p));
	}
	assert.throws(
		() => parseProject(' '.repeat(fixtureValues.oversizedBytes)),
		/8 MB/,
	);
	assert.throws(() => parseProject('{"__proto__": {}}'), /Reserved/);
});
test('unknown properties are preserved by save and rejected rather than silently lost by compile', async () => {
	const p = await fixture();
	const item = p.diagram.items.find((i) => i.id === 'quality');
	assert.ok(item);
	item.properties.unknown = 'Keep me';
	assert.equal(
		parseProject(serializeProject(p)).diagram.items.find(
			(i) => i.id === 'quality',
		)?.properties.unknown,
		'Keep me',
	);
	assert.throws(() => compile(p), /Unsupported property/);
});
test('zoom remains anchored and rectangle endpoints stay exactly on boundaries', () => {
	const view = { x: 17, y: -9, zoom: 0.7 };
	const pointer = { x: 300, y: 220 };
	const before = world(pointer, view);
	const afterZoom = world(
		pointer,
		zoomAt(view, pointer, fixtureValues.zoomFactor),
	);
	assert.ok(
		Math.abs(before.x - afterZoom.x) < fixtureValues.epsilon &&
			Math.abs(before.y - afterZoom.y) < fixtureValues.epsilon,
	);
	assert.deepEqual(
		boundary({ x: 10, y: 20, width: 100, height: 80 }, { x: 500, y: 60 }),
		{ x: 110, y: 60 },
	);
});
test('agent reference preserves text and CRLF, is idempotent, and rejects ambiguous markers', () => {
	const original = '# Existing\r\nKeep these rules.\r\n';
	const result = agentReference(original);
	assert.ok(result.startsWith(original));
	assert.equal(agentReference(result), result);
	assert.equal(result.split('<!-- tale:project:start -->').length, 2);
	assert.throws(
		() => agentReference('<!-- tale:project:start -->broken'),
		/ambiguous/,
	);
});
test('deployment preserves existing lower-case agent file and unrelated project files', async () => {
	const target = await temporary();
	const project = await fixture();
	await writeFile(join(target, 'agents.md'), 'Existing instructions\n');
	await mkdir(join(target, '.tale'));
	await writeFile(join(target, '.tale/keep.txt'), 'Keep me');
	await deployProject(target, project);
	const once = await readFile(join(target, 'agents.md'), 'utf8');
	await deployProject(target, project);
	assert.equal(await readFile(join(target, 'agents.md'), 'utf8'), once);
	assert.ok(once.startsWith('Existing instructions\n'));
	assert.deepEqual(
		await readFile(join(target, '.tale/project.tale')),
		await readFile('.tale/project.tale'),
	);
	assert.equal(
		await readFile(join(target, '.tale/keep.txt'), 'utf8'),
		'Keep me',
	);
	assert.ok(!(await readdir(target)).includes('AGENTS.md'));
});
test('fresh deployment writes compiled Tale bytes and an agent entry point', async () => {
	const target = await temporary();
	const project = await fixture();
	await deployProject(target, project);
	assert.deepEqual(await readdir(join(target, '.tale')), ['project.tale']);
	assert.ok(
		(await readFile(join(target, 'AGENTS.md'), 'utf8')).includes(
			'.tale/project.tale',
		),
	);
	await exportTales(target, project);
	assert.deepEqual(
		await readFile(join(target, '.tale/project.tale')),
		await readFile('.tale/project.tale'),
	);
});
test('a malformed agent block cannot partially replace deployed Tale files', async () => {
	const target = await temporary();
	const project = await fixture();
	await deployProject(target, project);
	const before = await readFile(join(target, '.tale/project.tale'));
	await writeFile(join(target, 'AGENTS.md'), '<!-- tale:project:start -->');
	const goal = project.diagram.items.find((item) => item.id === 'goal');
	assert.ok(goal);
	goal.properties.text = 'Should not be written';
	await assert.rejects(deployProject(target, project), /ambiguous/);
	assert.deepEqual(await readFile(join(target, '.tale/project.tale')), before);
});
test('symlinks cannot redirect deployment or save writes', {
	skip: process.platform === 'win32',
}, async () => {
	const target = await temporary();
	const outside = await temporary();
	await symlink(outside, join(target, '.tale'));
	await assert.rejects(
		deployProject(target, await fixture()),
		/real directory/,
	);
	await writeFile(join(outside, 'keep.json'), 'Original');
	await symlink(join(outside, 'keep.json'), join(target, 'linked.json'));
	await assert.rejects(
		atomicWrite(join(target, 'linked.json'), 'Changed'),
		/non-regular/,
	);
	assert.equal(await readFile(join(outside, 'keep.json'), 'utf8'), 'Original');
});
test('IPC rejects foreign senders, child frames and invalid responses', () => {
	const expected = { url: 'file:///app/index.html', webContentsId: 4 };
	assert.ok(trustedSender({ ...expected, mainFrame: true }, expected));
	assert.ok(!trustedSender({ ...expected, mainFrame: false }, expected));
	assert.ok(
		!trustedSender(
			{ ...expected, mainFrame: true, url: 'https://other.invalid' },
			expected,
		),
	);
	assert.ok(
		!trustedSender(
			{ ...expected, mainFrame: true, webContentsId: 5 },
			expected,
		),
	);
	assert.throws(() =>
		validateReply({ ok: true, document: { path: null, project: {} } }),
	);
});
