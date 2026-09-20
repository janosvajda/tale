import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseProject, serializeProject, validateProject } from './project.js';

test('project roundtrip preserves typed values and rejects unsafe nested property keys', async () => {
	const p = parseProject(await readFile('tale.project.json', 'utf8'));
	assert.deepEqual(parseProject(serializeProject(p)), p);
	const item = p.diagram.items[0];
	assert.ok(item);
	item.properties.extra = JSON.parse('{"constructor":"unsafe"}');
	assert.throws(() => validateProject(p), /Reserved/);
});

test('custom tags survive project roundtrip and cannot inject Tale headers', async () => {
	const project = parseProject(await readFile('tale.project.json', 'utf8'));
	const type = {
		id: 'team',
		label: 'Team rules',
		tag: 'TEAM_RULES',
		color: '#123456',
	};
	project.itemTypes.push(type);
	assert.deepEqual(
		parseProject(serializeProject(project)).itemTypes.at(-1),
		type,
	);
	type.tag = 'TEAM\nPROOF';
	assert.throws(() => validateProject(project), /Tags must start/);
});

test('custom section types and selections survive JSON and invalid radio selections fail validation', async () => {
	const project = parseProject(await readFile('tale.project.json', 'utf8'));
	const item = project.diagram.items[0];
	assert.ok(item);
	item.sections = [
		{
			id: 'text',
			title: 'Writing',
			type: 'text',
			text: 'Be concise.\nAsk first.',
		},
		{
			id: 'checks',
			title: 'Tools',
			type: 'checkboxes',
			options: [
				{ id: 'a', label: 'TypeScript', selected: true },
				{ id: 'b', label: 'Biome', selected: true },
			],
		},
		{
			id: 'radio',
			title: 'Approvals',
			type: 'radio',
			options: [
				{ id: 'a', label: 'Always', selected: true },
				{ id: 'b', label: 'Never', selected: false },
			],
		},
	];
	assert.deepEqual(
		parseProject(serializeProject(project)).diagram.items[0]?.sections,
		item.sections,
	);
	const radio = item.sections[2];
	assert.ok(radio && radio.type === 'radio');
	const option = radio.options[1];
	assert.ok(option);
	option.selected = true;
	assert.throws(() => validateProject(project), /only one selected/);
	option.selected = false;
	radio.options.push({ ...option });
	assert.throws(() => validateProject(project), /Duplicate section options ID/);
	radio.options.pop();
	item.sections.push({ ...radio });
	assert.throws(() => validateProject(project), /Duplicate sections ID/);
});
