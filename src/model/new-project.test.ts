import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fromTemplate, newProject, validateNewProject } from './new-project.js';
import { validateProject } from './project.js';
import { tags } from './tags.js';

test('new projects are empty and independent, with every built-in tag available', () => {
	const first = newProject();
	const second = newProject();
	validateProject(first);
	assert.notEqual(first.id, second.id);
	assert.deepEqual(first.diagram.items, []);
	assert.deepEqual(first.exports, []);
	assert.deepEqual(
		new Set(first.itemTypes.map((tag) => tag.tag)),
		new Set(tags),
	);
	first.itemTypes.length = 0;
	assert.equal(second.itemTypes.length, tags.length);
});

test('new projects can retain a project-specific tag catalogue without sharing it', () => {
	const catalogue = [
		{ id: 'custom', label: 'Team', tag: 'TEAM', color: '#123456' },
	];
	const project = newProject(catalogue);
	validateProject(project);
	assert.deepEqual(project.itemTypes, catalogue);
	project.itemTypes[0]!.label = 'Changed';
	assert.equal(catalogue[0]!.label, 'Team');
});

test('template creation validates inputs and clears an optional destination independently', () => {
	const template = newProject();
	template.deploymentDirectory = '/previous';
	const created = fromTemplate(template, {
		templateId: 'blank.json',
		title: '  My project  ',
	});
	assert.equal(created.name, 'My project');
	assert.equal(created.deploymentDirectory, undefined);
	validateProject(created);
	assert.equal(template.deploymentDirectory, '/previous');
	for (const value of [
		null,
		{},
		{ templateId: 'blank.json', title: ' ' },
		{ templateId: 'blank.json', title: 'OK', deploymentDirectory: 12 },
		{ templateId: 'blank.json', title: 'OK', deploymentDirectory: 'a\0b' },
		{ templateId: 'blank.json', title: 'OK', unexpected: true },
	])
		assert.throws(() => validateNewProject(value));
});
