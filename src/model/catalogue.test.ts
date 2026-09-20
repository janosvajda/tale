import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compile } from '../application/compiler.js';
import { definition, itemRole } from './catalogue.js';
import { fieldChoices, fieldLabel, initialValue } from './fields.js';
import { newProject } from './new-project.js';
import { parseProject, serializeProject, validateProject } from './project.js';

test('the shipped JSON is the complete catalogue used by new projects', async () => {
	const data = JSON.parse(await readFile('src/model/catalogue.json', 'utf8'));
	assert.deepEqual(newProject().itemTypes, data.tags);
	validateProject(newProject());
});

test('all tag names can change in data without changing compiler or verifier code', async () => {
	const project = parseProject(
		await readFile('project/tale.project.json', 'utf8'),
	);
	const before = compile(project)[0]!.content;
	const rename = new Map(
		project.itemTypes.map((tag) => [tag.tag, `CUSTOM_${tag.tag}`]),
	);
	for (const tag of project.itemTypes) {
		tag.tag = rename.get(tag.tag)!;
		for (const rule of tag.definition?.requiredTags ?? []) {
			rule.tag = rename.get(rule.tag)!;
			if (rule.when) rule.when.tag = rename.get(rule.when.tag)!;
		}
	}
	const expected = before
		.split('\n')
		.map((line) => {
			const space = line.indexOf(' ');
			const word = space < 0 ? line : line.slice(0, space);
			return rename.has(word)
				? rename.get(word) + line.slice(word.length)
				: line;
		})
		.join('\n');
	assert.equal(compile(project)[0]!.content, expected);
	assert.equal(
		compile(parseProject(serializeProject(project)))[0]!.content,
		expected,
	);
	assert.ok(
		project.diagram.items.some(
			(item) => itemRole(project, item) === 'requirement',
		),
	);
});

test('custom fields, choices and prefilled sections survive saving as portable data', () => {
	const project = newProject([]);
	project.itemTypes.push({
		id: 'team',
		tag: 'TEAM_NOTES',
		label: 'Team notes',
		color: '#123456',
		definition: {
			fields: [
				{
					key: 'tone',
					label: 'Writing tone',
					initial: 'concise',
					choices: ['concise', 'detailed'],
				},
			],
			initial: {
				properties: { tone: 'concise' },
				sections: [
					{
						id: 'note',
						title: 'Remember',
						type: 'text',
						text: 'Discuss scope first.',
					},
				],
			},
		},
	});
	const reopened = parseProject(serializeProject(project));
	const tag = reopened.itemTypes[0]!;
	assert.equal(fieldLabel('tone', tag), 'Writing tone');
	assert.deepEqual(fieldChoices(tag, 'tone', 'concise'), [
		'concise',
		'detailed',
	]);
	assert.equal(initialValue(tag, 'tone'), 'concise');
	assert.deepEqual(reopened.itemTypes, project.itemTypes);
	assert.equal(definition(tag).initial?.sections[0]?.title, 'Remember');
});

test('malformed definitions fail at the project boundary', () => {
	const project = newProject();
	const corrupt = JSON.parse(serializeProject(project));
	corrupt.itemTypes[0].definition.fields[0].format = 'execute-script';
	assert.throws(() => validateProject(corrupt), /Invalid field format/);
	corrupt.itemTypes[0].definition = {
		initial: {
			properties: {},
			sections: [
				{
					id: 'bad',
					type: 'radio',
					title: 'Select',
					options: [
						{ id: 'a', label: 'A', selected: true },
						{ id: 'b', label: 'B', selected: true },
					],
				},
			],
		},
	};
	assert.throws(() => validateProject(corrupt), /only one selected/);
});
