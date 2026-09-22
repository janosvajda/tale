import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseProject } from '../model/project.js';
import { compile } from './compiler.js';

test('human-language notes compile as written and remain byte-for-byte deterministic', async () => {
	const movedZoom = 1.25;
	const movedX = 100;
	const project = parseProject(
		await readFile('project/tale.project.json', 'utf8'),
	);
	const item = project.diagram.items.find(
		(entry) => entry.definitionId === 'changes',
	);
	assert.ok(item);
	item.text = 'Deny unrelated changes.\nAsk before expanding scope.';
	const first = compile(project)[0];
	assert.ok(first);
	assert.equal(first.path, '.tale/project.tale');
	assert.match(
		first.content,
		/CHANGES\n  Deny unrelated changes\.\n  Ask before expanding scope\./,
	);
	assert.ok(!first.content.includes('unrelated_changes deny'));
	project.diagram.viewport.zoom = movedZoom;
	item.position.x += movedX;
	assert.deepEqual(compile(project)[0], first);
	assert.deepEqual(compile(project)[0], compile(project)[0]);
});

test('the checked-in project Tale matches its JSON source byte for byte', async () => {
	const project = parseProject(
		await readFile('project/tale.project.json', 'utf8'),
	);
	const installed = await readFile('.tale/project.tale', 'utf8');
	assert.equal(compile(project)[0]?.content, installed);
});

test('the diagram records meaningful relationships without a visible root', async () => {
	const project = parseProject(
		await readFile('project/tale.project.json', 'utf8'),
	);
	assert.ok(!project.diagram.items.some((item) => item.id === 'project'));
	assert.ok(
		project.diagram.connections.every(
			(edge) => edge.label && edge.from !== 'project' && edge.to !== 'project',
		),
	);
	assert.ok(
		project.diagram.connections.some(
			(edge) =>
				edge.from === 'product' &&
				edge.to === 'architecture' &&
				edge.label === 'guides',
		),
	);
	for (const requirement of [
		'deployment-bytes',
		'no-project-json',
		'preserve-project',
	])
		assert.ok(
			project.diagram.connections.some(
				(edge) =>
					edge.from === requirement &&
					edge.to === 'deploy-check' &&
					edge.label === 'is verified by',
			),
		);
	assert.ok(
		compile(project)[0]?.content.includes('  Purpose defines Product.'),
	);
	assert.ok(!compile(project)[0]?.content.includes('RELATIONSHIPS'));
	project.diagram.connections[0]!.label = '';
	assert.throws(
		() => compile(project),
		/Give every arrow a one-line relationship/,
	);
});

test('Skills use the same single text value as Tags', async () => {
	const project = parseProject(await readFile('templates/blank.json', 'utf8'));
	const skill = project.definitions.find(
		(entry) => entry.name === 'Minimal change',
	);
	assert.ok(skill);
	project.diagram.items.push({
		id: 'small-change',
		definitionId: skill.id,
		title: skill.name,
		text: 'Make the smallest change needed. Stop when the agreed check passes.',
		position: { x: 0, y: 0 },
		size: { width: 280, height: 180 },
	});
	assert.match(
		compile(project)[0]!.content,
		/SKILL Minimal change\n  Make the smallest change needed\. Stop when the agreed check passes\./,
	);
});
