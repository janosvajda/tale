import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import type { Bridge } from '../model/bridge.js';

test('preload exposes a frozen allowlist, filters menu events and removes subscriptions', async () => {
	let bridge: Bridge | undefined;
	const calls: unknown[][] = [];
	let listener: ((event: unknown, action: unknown) => void) | undefined;
	let removed = false;
	const electron = {
		contextBridge: {
			exposeInMainWorld: (name: string, value: Bridge) => {
				assert.equal(name, 'tale');
				bridge = value;
			},
		},
		ipcRenderer: {
			invoke: (...args: unknown[]) => {
				calls.push(args);
				return Promise.resolve({ ok: true });
			},
			on: (_name: string, fn: typeof listener) => {
				listener = fn;
			},
			removeListener: (_name: string, fn: typeof listener) => {
				assert.equal(fn, listener);
				removed = true;
			},
		},
	};
	runInNewContext(await readFile('dist/node/src/preload/index.js', 'utf8'), {
		exports: {},
		require: () => electron,
	});
	assert.ok(bridge);
	assert.ok(Object.isFrozen(bridge));
	assert.equal('send' in bridge, false);
	await bridge.setDirty(true);
	assert.deepEqual(calls, [['tale:dirty', true]]);
	const request = { templateId: 'blank.json', title: 'My project' };
	await bridge.templates();
	await bridge.chooseDirectory('/suggested');
	await bridge.newProject(request);
	assert.deepEqual(calls.slice(1), [
		['tale:templates'],
		['tale:choose-directory', '/suggested'],
		['tale:new', request],
	]);
	await bridge.exit();
	assert.deepEqual(calls.at(-1), ['tale:exit']);
	await bridge.recentProjects();
	assert.deepEqual(calls.at(-1), ['tale:recent-projects']);
	await bridge.open('/recent/project.json');
	assert.deepEqual(calls.at(-1), ['tale:open', '/recent/project.json']);
	const actions: string[] = [];
	const unsubscribe = bridge.onMenu((action) => actions.push(action));
	listener?.({}, 'open');
	listener?.({}, 'exit');
	listener?.({}, 'arbitrary-channel');
	listener?.({}, {});
	assert.deepEqual(actions, ['open', 'exit']);
	unsubscribe();
	assert.equal(removed, true);
	const progress: number[] = [];
	const stop = bridge.onDeploymentProgress((value) =>
		progress.push(value.completed),
	);
	listener?.(
		{},
		{ token: 'preview', completed: 1, total: 2, path: '.tale/project.tale' },
	);
	listener?.(
		{},
		{ token: 'preview', completed: 3, total: 2, path: '.tale/project.tale' },
	);
	assert.deepEqual(progress, [1]);
	stop();
});
