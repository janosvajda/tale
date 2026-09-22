import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { dockIcon, windowIcon } from './app-icons.js';

test('application icons use the packaged asset suited to each desktop', async () => {
	assert.equal(
		windowIcon('/app', 'win32'),
		join('/app', 'dist/resources/tale_electron_icons/tale.ico'),
	);
	assert.equal(
		windowIcon('/app', 'linux'),
		join('/app', 'dist/resources/tale_electron_icons/tale-256.png'),
	);
	assert.equal(
		dockIcon('/app'),
		join('/app', 'dist/resources/tale_electron_icons/tale-512.png'),
	);
	for (const file of [
		'tale.ico',
		'tale.icns',
		'tale-16.png',
		'tale-32.png',
		'tale-48.png',
		'tale-64.png',
		'tale-128.png',
		'tale-256.png',
		'tale-512.png',
	])
		await access(join('dist/resources/tale_electron_icons', file));
});
