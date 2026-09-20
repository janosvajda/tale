import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseProject } from '../model/project.js';
import { compile } from './compiler.js';

test('a diagram with one Tale compiles without manually configuring a file', async () => {
	const project = parseProject(
		await readFile('project/tale.project.json', 'utf8'),
	);
	const expected = compile(project);
	project.exports = [];
	project.environments = [
		{ id: 'test', name: 'Test' },
		{ id: 'production', name: 'Production' },
	];
	assert.deepEqual(compile(project), expected);
	assert.deepEqual(compile(parseProject(JSON.stringify(project))), expected);
	const root = project.diagram.items.find((item) => item.id === 'project')!;
	project.diagram.items.push({ ...structuredClone(root), id: 'second-tale' });
	assert.throws(() => compile(project), /Choose one Tale/);
});

test('paired-test and semantic-control policy compiles exactly from the authoring JSON', async () => {
	const project = parseProject(
		await readFile('project/tale.project.json', 'utf8'),
	);
	const output = compile(project)[0];
	assert.ok(output);
	assert.deepEqual(
		Buffer.from(output.content),
		await readFile('.tale/project.tale'),
	);
	assert.ok(output.content.includes('test_pattern {name}.test.ts'));
	assert.ok(output.content.includes('raw_json_editing deny'));
});

test('user-defined tags compile deterministically with custom sections and sorted properties', async () => {
	const project = parseProject(
		await readFile('project/tale.project.json', 'utf8'),
	);
	const item = project.diagram.items.find((item) => item.id === 'product');
	assert.ok(item);
	project.itemTypes.push({
		id: 'team',
		label: 'Team rules',
		tag: 'TEAM_RULES',
		color: '#123456',
	});
	item.typeId = 'team';
	item.properties = { tone: 'Concise', audience: 'Everyone' };
	item.sections = [
		{
			id: 'notes',
			title: 'Discuss changes',
			type: 'text',
			text: 'Agree before editing.',
		},
	];
	const output = compile(project);
	assert.ok(
		output[0]?.content.includes(
			'TEAM_RULES\n  audience Everyone\n  tone Concise\n  section "Discuss changes" type=text\n    text "Agree before editing."',
		),
	);
	item.properties = { audience: 'Everyone', tone: 'Concise' };
	assert.deepEqual(compile(parseProject(JSON.stringify(project))), output);
	item.properties = { 'bad\nGOAL': 'injection' };
	assert.throws(() => compile(project), /Invalid directive/);
});

test('custom sections compile deterministically with literal titles, text and selected choices', async () => {
	const project = parseProject(
		await readFile('project/tale.project.json', 'utf8'),
	);
	const item = project.diagram.items.find((item) => item.id === 'goal');
	assert.ok(item);
	item.sections = [
		{
			id: 'notes',
			title: 'Team "notes"',
			type: 'text',
			text: 'Ask first.\nThen implement.',
		},
		{
			id: 'tools',
			title: 'Tools',
			type: 'checkboxes',
			options: [
				{ id: 'a', label: 'TypeScript', selected: true },
				{ id: 'b', label: 'Unused', selected: false },
				{ id: 'c', label: 'Biome', selected: true },
			],
		},
		{
			id: 'approval',
			title: 'Approval',
			type: 'radio',
			options: [
				{ id: 'a', label: 'Required', selected: true },
				{ id: 'b', label: 'Optional', selected: false },
			],
		},
	];
	const expected = [
		'  section "Team \\"notes\\"" type=text',
		'    text "Ask first.\\nThen implement."',
		'  section "Tools" type=checkboxes',
		'    selected "TypeScript" "Biome"',
		'  section "Approval" type=radio',
		'    selected "Required"',
	].join('\n');
	const output = compile(project);
	assert.ok(output[0]?.content.includes(expected));
	assert.ok(!output[0]?.content.includes('Unused'));
	assert.deepEqual(compile(parseProject(JSON.stringify(project))), output);
	for (const section of item.sections) section.id += '-changed';
	assert.deepEqual(
		compile(project),
		output,
		'Editor IDs do not affect compiled bytes',
	);
});
