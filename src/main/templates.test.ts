import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { compile } from '../application/compiler.js';
import { parseProject, serializeProject } from '../model/project.js';
import { createFromTemplate, listTemplates } from './templates.js';

test('starter diagrams are portable, independent projects with deterministic Tale output', async () => {
	const templates = await listTemplates('templates');
	assert.deepEqual(
		templates.map((template) => template.id),
		[
			'blank.json',
			'node-typescript-biome-webpack.json',
			'node-typescript-eslint-webpack.json',
			'rust-clippy.json',
		],
	);
	for (const template of templates) {
		const source = await readFile(join('templates', template.id), 'utf8');
		const request = {
			templateId: template.id,
			title: 'My application',
			deploymentDirectory: '/not-created-yet',
		};
		const first = await createFromTemplate('templates', request);
		const second = await createFromTemplate('templates', request);
		assert.notEqual(first.id, second.id);
		assert.equal(first.name, request.title);
		assert.equal(first.deploymentDirectory, request.deploymentDirectory);
		const reopened = parseProject(serializeProject(first));
		assert.deepEqual(reopened, first);
		if (template.id === 'blank.json')
			assert.equal(first.diagram.items.length, 0);
		else {
			const output = compile(first);
			assert.equal(output.length, 1);
			assert.equal(output[0]?.path, '.tale/project.tale');
			assert.deepEqual(compile(reopened), output);
			assert.deepEqual(compile(second), output);
			const content = output[0]!.content;
			assert.match(content, /SCOPE require_approval/);
			assert.match(content, /stop after_agreed_checks/);
			if (template.id.startsWith('rust')) {
				assert.match(content, /cargo clippy --all-targets -- -D warnings/);
				assert.match(content, /cargo test/);
			} else {
				assert.match(content, /Webpack/);
				assert.match(content, /typescript_strict true/);
				assert.match(
					content,
					template.id.includes('eslint')
						? /eslint \. --max-warnings 0/
						: /biome check \./,
				);
			}
		}
		first.itemTypes.length = 0;
		assert.ok(second.itemTypes.length);
		assert.equal(
			await readFile(join('templates', template.id), 'utf8'),
			source,
		);
	}
});

test('templates are discovered from JSON, with no hardcoded list or arbitrary file access', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'tale-templates-'));
	try {
		const blank = parseProject(await readFile('templates/blank.json', 'utf8'));
		blank.name = 'Team starter';
		await writeFile(join(directory, 'team.json'), serializeProject(blank));
		await writeFile(join(directory, 'README.md'), 'Not a template');
		assert.deepEqual(await listTemplates(directory), [
			{ id: 'team.json', name: 'Team starter' },
		]);
		const project = await createFromTemplate(directory, {
			templateId: 'team.json',
			title: 'New team project',
		});
		assert.equal(project.name, 'New team project');
		for (const templateId of [
			'../blank.json',
			'/tmp/team.json',
			'missing.json',
		])
			await assert.rejects(
				createFromTemplate(directory, { templateId, title: 'Unsafe' }),
				/Unknown Tale template/,
			);
		await writeFile(join(directory, 'broken.json'), '{}');
		await assert.rejects(
			listTemplates(directory),
			/Unsupported project format/,
		);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
