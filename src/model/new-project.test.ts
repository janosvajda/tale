import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fromTemplate, newProject } from './new-project.js';
import { validateProject } from './project.js';

test('new projects and templates use format two with independent definitions', () => {
	const template = newProject();
	validateProject(template);
	assert.equal(template.formatVersion, 2);
	const created = fromTemplate(template, {
		templateId: 'blank.json',
		title: 'My Tale',
	});
	assert.equal(created.name, 'My Tale');
	created.definitions[0]!.defaultText = 'Changed only here.';
	assert.notEqual(
		template.definitions[0]!.defaultText,
		created.definitions[0]!.defaultText,
	);
	assert.equal(created.diagram.items.length, 0);
});
