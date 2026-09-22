import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

test('startup wires native file actions to the correct named renderer commands', async () => {
	const sent: string[][] = [];
	let menu: {
		label: string;
		submenu: { label: string; click?: () => void }[];
	}[] = [];
	let lifecycle = false;
	let dockIcon = '';
	const ready = Promise.resolve();
	const electron = {
		app: {
			dock: { setIcon: (path: string) => (dockIcon = path) },
			setName: () => {},
			whenReady: () => ready,
			getAppPath: () => '/app',
			exit: () => assert.fail('Unexpected startup failure'),
		},
		Menu: {
			buildFromTemplate: (value: typeof menu) => value,
			setApplicationMenu: (value: typeof menu) => {
				menu = value;
			},
		},
	};
	const modules: Record<string, unknown> = {
		electron,
		'./app-icons.js': { dockIcon: () => '/app/icon.png' },
		'./lifecycle.js': {
			quitWhenWindowsClose: () => {
				lifecycle = true;
			},
		},
		'./window.js': {
			createWindow: () =>
				Promise.resolve({
					webContents: { send: (...args: string[]) => sent.push(args) },
				}),
		},
	};
	runInNewContext(await readFile('dist/node/src/main/index.js', 'utf8'), {
		exports: {},
		require: (name: string) => modules[name],
		process: { platform: 'darwin' },
		console,
	});
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(lifecycle, true);
	assert.equal(dockIcon, '/app/icon.png');
	const file = menu.find((item) => item.label === 'File');
	assert.ok(file);
	assert.ok(file.submenu.some((item) => item.label === 'Open project…'));
	for (const item of file.submenu) item.click?.();
	assert.deepEqual(
		sent.map((args) => args[1]),
		['new', 'open', 'save', 'saveAs', 'deploy', 'compile', 'exit'],
	);
});
