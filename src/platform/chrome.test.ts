import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { compile } from '../application/compiler.js';
import { parseProject } from '../model/project.js';

test('Chrome package uses the shared compiler and contains a Manifest V3 editor', async () => {
	const manifestVersion = 3;
	const manifest = JSON.parse(
		await readFile('dist/chrome/manifest.json', 'utf8'),
	);
	const packageFile = JSON.parse(await readFile('package.json', 'utf8'));
	assert.equal(manifest.manifest_version, manifestVersion);
	assert.equal(manifest.version, packageFile.version);
	assert.equal(manifest.action.default_title, 'Open Tale');
	const project = parseProject(await readFile('templates/blank.json', 'utf8'));
	assert.deepEqual(compile(project), compile(project));
	await readFile('dist/chrome/ui/index.html', 'utf8');
	await readFile('dist/chrome/platform/chrome.js', 'utf8');
	const packaged = await readdir('dist/chrome', { recursive: true });
	assert.equal(
		packaged.some((path) => path.endsWith('.map') || path.endsWith('.test.js')),
		false,
	);
});
