import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
	lastOpenDirectory,
	lastDeploymentDirectory,
	recentProjects,
	rememberDeploymentDirectory,
	rememberOpenDirectory,
	rememberRecentProject,
} from './preferences.js';

test('Open remembers its folder on disk and tolerates missing or invalid preferences', async () => {
	const root = await mkdtemp(join(tmpdir(), 'tale-preferences-'));
	const preferences = join(root, 'settings', 'dialogs.json');
	const folder = join(root, 'my projects');
	try {
		assert.equal(await lastOpenDirectory(preferences), undefined);
		await mkdir(folder);
		await rememberOpenDirectory(preferences, join(folder, 'project.json'));
		assert.equal(await lastOpenDirectory(preferences), folder);
		await rememberOpenDirectory(preferences, join(root, 'another.json'));
		assert.equal(await lastOpenDirectory(preferences), root);
		await rememberOpenDirectory(preferences, join(folder, 'project.json'));
		await rm(folder, { recursive: true });
		assert.equal(await lastOpenDirectory(preferences), undefined);
		for (const invalid of [
			'{',
			'{}',
			'{"openDirectory":42}',
			'{"openDirectory":"relative/path"}',
			JSON.stringify({ openDirectory: preferences }),
		]) {
			await writeFile(preferences, invalid);
			assert.equal(await lastOpenDirectory(preferences), undefined);
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
test('recent projects keep ten distinct existing files, newest first', async (t) => {
	const root = await mkdtemp(join(tmpdir(), 'tale-recent-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const preferences = join(root, 'settings.json');
	const paths: string[] = [];
	const createdCount = 12;
	for (let index = 0; index < createdCount; index++) {
		const path = join(root, `project-${index}.json`);
		await writeFile(path, '{}');
		await rememberRecentProject(preferences, path);
		paths.push(await realpath(path));
	}
	assert.deepEqual(
		await recentProjects(preferences),
		paths.slice(-10).reverse(),
	);
	await rememberRecentProject(preferences, paths[5]!);
	const reordered = await recentProjects(preferences);
	assert.equal(reordered[0], paths[5]);
	assert.equal(reordered.length, 10);
	assert.equal(new Set(reordered).size, reordered.length);
	await rm(paths[5]!);
	assert.ok(!(await recentProjects(preferences)).includes(paths[5]!));
});
test('deployment destinations belong to saved project paths and must still exist', async (t) => {
	const root = await mkdtemp(join(tmpdir(), 'tale-deploy-pref-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	const preferences = join(root, 'settings.json');
	const first = join(root, 'first.json');
	const second = join(root, 'second.json');
	const firstTarget = join(root, 'first-target');
	const secondTarget = join(root, 'second-target');
	await writeFile(first, '{}');
	await writeFile(second, '{}');
	await mkdir(firstTarget);
	await mkdir(secondTarget);
	const resolvedFirstTarget = await realpath(firstTarget);
	const resolvedSecondTarget = await realpath(secondTarget);
	assert.equal(await lastDeploymentDirectory(preferences, first), undefined);
	await rememberDeploymentDirectory(preferences, first, firstTarget);
	await rememberDeploymentDirectory(preferences, second, secondTarget);
	await rememberRecentProject(preferences, first);
	assert.equal(
		await lastDeploymentDirectory(preferences, first),
		resolvedFirstTarget,
	);
	assert.equal(
		await lastDeploymentDirectory(preferences, second),
		resolvedSecondTarget,
	);
	await rm(firstTarget, { recursive: true });
	assert.equal(await lastDeploymentDirectory(preferences, first), undefined);
	assert.equal(
		await lastDeploymentDirectory(preferences, second),
		resolvedSecondTarget,
	);
});
