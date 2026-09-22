import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseProject, serializeProject, validateProject } from './project.js';

test('format two saves one text value per note and rejects the retired format', async () => {
	const project = parseProject(
		await readFile('project/tale.project.json', 'utf8'),
	);
	assert.deepEqual(parseProject(serializeProject(project)), project);
	assert.ok(
		project.diagram.items.every(
			(item) =>
				typeof item.text === 'string' &&
				!('sections' in item) &&
				!('properties' in item),
		),
	);
	const old = { ...project, formatVersion: 1 };
	assert.throws(() => validateProject(old), /Unsupported project format/);
});

test('duplicate names, missing definitions and unsafe geometry are rejected', async () => {
	const project = parseProject(
		await readFile('project/tale.project.json', 'utf8'),
	);
	project.definitions.push({
		...project.definitions[0]!,
		id: 'duplicate',
		name: ` ${project.definitions[0]!.name.toUpperCase()} `,
	});
	assert.throws(() => validateProject(project), /names must be unique/);
	project.definitions.pop();
	project.diagram.items[0]!.definitionId = 'missing';
	assert.throws(() => validateProject(project), /Unknown Tag or Skill/);
});
