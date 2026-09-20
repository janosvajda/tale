import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { lastOpenDirectory, rememberOpenDirectory } from './preferences.js';

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
