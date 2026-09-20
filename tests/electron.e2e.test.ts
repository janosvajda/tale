const fixtureValues = {
	buttonZoomStep: 1.2,
	percent: 100,
	deploySettleMs: 150,
	dragSteps: 5,
	errorLogLevel: 3,
	extendedItemCount: 23,
	extendedTypeCount: 21,
	extensionLength: 3,
	gestureSettleMs: 80,
	goalMoveX: 30,
	goalMoveY: 20,
	largeHeight: 940,
	largeWidth: 1440,
	moveY: 35,
	originalItemCount: 22,
	pointerStepMs: 20,
	pollMs: 40,
	resizeX: 28,
	resizeY: 14,
	smallHeight: 680,
	smallWidth: 960,
	timeoutMs: 10000,
	windowSettleMs: 100,
	zoomSettleMs: 250,
};

import assert from 'node:assert/strict';
import {
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	rm,
	writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app, type BrowserWindow, type MouseWheelInputEvent } from 'electron';
import { compile } from '../src/application/compiler.js';
import { quitWhenWindowsClose } from '../src/main/lifecycle.js';
import { createWindow, type FileDialogs } from '../src/main/window.js';
import { parseProject } from '../src/model/project.js';

const root = process.cwd();
const keepAliveBetweenSessions = () => {};
app.on('window-all-closed', keepAliveBetweenSessions);
let accepted = false;
app.on('will-quit', () => {
	if (!accepted) {
		console.error('Electron exited before the acceptance checks completed');
		app.exit(1);
	}
});
let win: BrowserWindow;
let directory = '';
let openPath: string | undefined;
let savePath: string | undefined;
let target: string | undefined;
let discard = true;
const openSuggestions: (string | undefined)[] = [];
const targetSuggestions: (string | undefined)[] = [];
let approveContract = false;
let approvalReviews: string[] = [];
const dialogs: FileDialogs = {
	open(defaultPath) {
		openSuggestions.push(defaultPath);
		return Promise.resolve(openPath);
	},
	save() {
		return Promise.resolve(savePath);
	},
	target(defaultPath) {
		targetSuggestions.push(defaultPath);
		return Promise.resolve(target);
	},
	discard() {
		return Promise.resolve(discard);
	},
};
function evaluate<T>(code: string): Promise<T> {
	return win.webContents.executeJavaScript(code, true) as Promise<T>;
}
async function until(code: string) {
	const deadline = Date.now() + fixtureValues.timeoutMs;
	while (Date.now() < deadline) {
		if (await evaluate<boolean>(code)) return;
		await new Promise((resolve) => setTimeout(resolve, fixtureValues.pollMs));
	}
	throw new Error(
		`Timed out: ${code}\n${await evaluate<string>('document.querySelector("#status")?.textContent')}`,
	);
}
async function click(selector: string) {
	await until('document.body.dataset.busy !== "true"');
	await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
	await until('document.body.dataset.busy !== "true"');
}
async function deploymentPreview() {
	await click('[data-action="deploy"]');
	await click('[aria-label="Choose project folder"]');
	await until(
		'document.querySelectorAll(".deployment-preview details").length > 0 && !document.querySelector(".deployment-folder button").disabled',
	);
}
async function deployCurrent() {
	await deploymentPreview();
	if (
		await evaluate('!document.querySelector(".deployment-overwrite").hidden')
	) {
		assert.equal(
			await evaluate('document.querySelector("#confirm-deployment").disabled'),
			true,
		);
		await click('[aria-label="Overwrite existing Tale deployment"]');
	}
	await click('#confirm-deployment');
	await until('!document.querySelector("#deployment")');
}
function point(selector: string) {
	return evaluate<{ x: number; y: number }>(
		`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2)}; })()`,
	);
}
async function drag(
	from: { x: number; y: number },
	to: { x: number; y: number },
	button: 'left' | 'right' = 'left',
) {
	win.webContents.sendInputEvent({ type: 'mouseMove', ...from });
	win.webContents.sendInputEvent({
		type: 'mouseDown',
		button,
		clickCount: 1,
		...from,
	});
	for (let step = 1; step <= fixtureValues.dragSteps; step++) {
		win.webContents.sendInputEvent({
			type: 'mouseMove',
			x: Math.round(
				from.x + ((to.x - from.x) * step) / fixtureValues.dragSteps,
			),
			y: Math.round(
				from.y + ((to.y - from.y) * step) / fixtureValues.dragSteps,
			),
			modifiers: [button === 'left' ? 'leftbuttondown' : 'rightbuttondown'],
		});
		await new Promise((resolve) =>
			setTimeout(resolve, fixtureValues.pointerStepMs),
		);
	}
	win.webContents.sendInputEvent({
		type: 'mouseUp',
		button,
		clickCount: 1,
		...to,
	});
	await new Promise((resolve) =>
		setTimeout(resolve, fixtureValues.gestureSettleMs),
	);
}
async function saved(path: string) {
	const deadline = Date.now() + fixtureValues.timeoutMs;
	while (Date.now() < deadline) {
		try {
			return await readFile(path);
		} catch {
			await new Promise((resolve) => setTimeout(resolve, fixtureValues.pollMs));
		}
	}
	throw new Error(`File was not written: ${path}`);
}
async function saveAs(path: string) {
	savePath = path;
	await click('[data-action="saveAs"]');
	const result = await saved(path);
	await until(
		'!document.querySelector("#dirty").classList.contains("visible")',
	);
	return parseProject(result.toString());
}
async function compileAndExport(path: string, expected: Buffer) {
	target = path;
	await click('[data-action="compile"]');
	await until('document.querySelector("#preview").open');
	const text = await evaluate<string>(
		'document.querySelector("#compiled-output").value',
	);
	assert.deepEqual(Buffer.from(text), expected);
	await click('#export-tales');
	assert.deepEqual(await saved(join(path, '.tale/project.tale')), expected);
	await until(
		'document.querySelector("#status").textContent.includes("Exported")',
	);
	await click('#close-preview');
}
async function session(run: number, expected: Buffer) {
	win = await createWindow(root, {
		hidden: false,
		dialogs,
		preferencesPath: join(directory, 'file-dialogs.json'),
		approvalStore: join(directory, 'trusted-approvals'),
		confirmApproval: (details) => {
			approvalReviews.push(details);
			return Promise.resolve(approveContract);
		},
	});
	// Keep physical desktop mouse movement separate from webContents test input.
	win.setIgnoreMouseEvents(true);
	const errors: string[] = [];
	win.webContents.on('console-message', (_event, level, message) => {
		if (level >= fixtureValues.errorLogLevel) errors.push(message);
	});
	await until('document.body.dataset.ready === "true"');
	assert.equal(await evaluate('document.querySelectorAll(".node").length'), 0);
	await click('.appbar > [data-action="verify"]');
	await until('document.querySelector("#verification")?.open');
	assert.equal(
		await evaluate(
			'document.querySelector("#verification [role=status]").textContent',
		),
		'No automated checks configured',
	);
	await click('[aria-label="Close verification"]');
	await until('!document.querySelector("#verification")');
	openPath = undefined;
	await click('[data-action="open"]');
	if (run > 1)
		assert.equal(
			openSuggestions.at(-1),
			JSON.parse(await readFile(join(directory, 'file-dialogs.json'), 'utf8'))
				.openDirectory,
		);
	assert.equal(await evaluate('document.querySelectorAll(".node").length'), 0);
	openPath = join(directory, 'missing.json');
	await click('[data-action="open"]');
	assert.ok(
		await evaluate(
			'document.querySelector("#status").textContent.includes("ENOENT")',
		),
	);
	openPath = join(root, 'project/tale.project.json');
	await click('[data-action="open"]');
	assert.equal(
		await evaluate('document.querySelectorAll(".node").length'),
		fixtureValues.originalItemCount,
	);

	openPath = undefined;
	await click('[data-action="open"]');
	assert.equal(
		openSuggestions.at(-1),
		join(root, 'project'),
		'Open reuses the successfully opened project folder',
	);
	assert.equal(
		JSON.parse(await readFile(join(directory, 'file-dialogs.json'), 'utf8'))
			.openDirectory,
		join(root, 'project'),
	);
	assert.equal(await evaluate('typeof window.require'), 'undefined');
	assert.equal(await evaluate('typeof window.tale.send'), 'undefined');
	assert.equal(
		await evaluate(
			'document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth',
		),
		false,
	);
	const output = join(directory, `session-${run}`);
	await mkdir(output);
	await compileAndExport(output, expected);
	const file = join(directory, `roundtrip-${run}.json`);
	await saveAs(file);
	openPath = file;
	await click('[data-action="open"]');
	await until(
		'!document.querySelector("#dirty").classList.contains("visible")',
	);
	const savedProjectBytes = await readFile(file);
	const reopened = join(directory, `reopened-${run}`);
	await mkdir(reopened);
	await compileAndExport(reopened, expected);
	const deployment = join(directory, `deployed-${run}`);
	await mkdir(deployment);
	target = deployment;
	await deployCurrent();
	assert.deepEqual(
		await readFile(join(deployment, '.tale/project.tale')),
		expected,
	);
	await deployCurrent();
	assert.deepEqual(
		await readFile(join(deployment, '.tale/project.tale')),
		expected,
	);
	assert.deepEqual(await readdir(join(deployment, '.tale')), ['project.tale']);
	assert.deepEqual(await readFile(file), savedProjectBytes);
	if (run === 1) {
		await verificationInteractions(expected);
		const project = JSON.parse(
			await readFile('project/tale.project.json', 'utf8'),
		);
		for (const path of (await readdir('src', { recursive: true })).sort()) {
			if (
				!path.endsWith('.test.ts') ||
				!(await readFile(join('src', path), 'utf8')).startsWith(
					'// @browser-test',
				)
			)
				continue;
			const modulePath =
				'../' +
				path.split('\\').join('/').slice(0, -fixtureValues.extensionLength) +
				'.js';
			await evaluate(
				`import(${JSON.stringify(modulePath)}).then(module => module.run(${JSON.stringify(project)}))`,
			);
			console.log(`Browser pair passed: ${path}`);
		}
		const changed = await saveAs(join(directory, 'friendly-controls.json'));
		assert.deepEqual(
			changed.diagram.items.find((i) => i.id === 'product')?.properties
				.platforms,
			['macOS', 'Linux'],
		);
		openPath = join(directory, 'friendly-controls.json');
		await click('[data-action="open"]');
		await evaluate(`import('../ui/app.test.js').then(() => {
      const node=document.querySelector('[data-node="product"] .node-body');
      node.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:1}));
      node.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,pointerId:1}));
      const input=document.querySelector('input[aria-label="Supported platforms: Windows"]');
      if(input.checked) throw new Error('Reopened checkbox lost its saved value');
      input.click();
    })`);
		await compileAndExport(reopened, expected);
		openPath = file;
		await click('[data-action="open"]');
		await navigationInteractions(file);
		await interactions();
		await customTagInteractions(expected);
		await customSectionInteractions(expected);
	}
	const failed = await evaluate<{ ok: boolean }>(
		'window.tale.save({format:"bad"}, false)',
	);
	assert.equal(failed.ok, false);
	assert.equal(errors.length, 0, errors.join('\n'));
	await evaluate('window.tale.setDirty(false)');
	win.close();
	await new Promise<void>((resolve) => {
		if (win.isDestroyed()) resolve();
		else win.once('closed', resolve);
	});
	console.log(
		`Session ${run}: built editor export, save/reopen, exact fixture comparison and IPC validation passed`,
	);
}
async function navigationInteractions(originalFile: string) {
	await evaluate('localStorage.setItem("tale.navigation", "auto")');
	const loaded = new Promise<void>((resolve) =>
		win.webContents.once('did-finish-load', () => resolve()),
	);
	win.webContents.reload();
	await loaded;
	win.setIgnoreMouseEvents(true);
	await until('document.body.dataset.ready === "true"');
	openPath = originalFile;
	await click('[data-action="open"]');
	assert.equal(
		await evaluate('document.querySelector("#navigation-mode").value'),
		'mouse',
	);
	assert.equal(
		await evaluate('localStorage.getItem("tale.navigation")'),
		'mouse',
		'Migrate persisted Auto preference',
	);
	const before = await saveAs(join(directory, 'navigation-before.json'));
	await click('#file-menu > summary');
	assert.equal(
		await evaluate('document.querySelector("#file-menu").open'),
		true,
	);
	const start = await point('[data-node="product"] .node-body');
	await drag(start, { x: start.x, y: start.y + fixtureValues.moveY }, 'right');
	assert.equal(
		await evaluate('document.querySelector("#file-menu").open'),
		false,
	);
	const panned = await saveAs(join(directory, 'navigation-pan.json'));
	assert.deepEqual(panned.diagram.items, before.diagram.items);
	assert.equal(
		panned.diagram.viewport.y,
		before.diagram.viewport.y + fixtureValues.moveY,
	);
	assert.equal(panned.diagram.viewport.zoom, before.diagram.viewport.zoom);
	await setControl('#navigation-mode', 'trackpad');
	assert.equal(
		await evaluate('localStorage.getItem("tale.navigation")'),
		'trackpad',
	);
	const scroll = { x: 12, y: 24 };
	await nativeWheel(-scroll.y, true, -scroll.x);
	const scrolled = await saveAs(join(directory, 'navigation-scroll.json'));
	assert.equal(scrolled.diagram.viewport.zoom, panned.diagram.viewport.zoom);
	assert.equal(
		scrolled.diagram.viewport.x,
		panned.diagram.viewport.x - scroll.x,
	);
	assert.equal(
		scrolled.diagram.viewport.y,
		panned.diagram.viewport.y - scroll.y,
	);
	assert.deepEqual(scrolled.diagram.items, before.diagram.items);
	await setControl('#navigation-mode', 'mouse');
	await nativeWheel(fixtureValues.moveY);
	const zoomed = await saveAs(join(directory, 'navigation-zoom.json'));
	assert.ok(zoomed.diagram.viewport.zoom > scrolled.diagram.viewport.zoom);
	await nativeZoomChecks();
	await setControl('#navigation-mode', 'mouse');
	openPath = originalFile;
	await click('[data-action="open"]');
	console.log(
		'Navigation: outside-click dismissal, right-drag, trackpad pan, mouse zoom and saved preference passed',
	);
}
const navigationInput = {
	x: 600,
	y: 400,
	cocoaPixelsPerTick: 40,
	scale: 1.25,
	tolerance: 0.002,
	smallWheel: 3,
};
function viewport() {
	return evaluate<{ x: number; y: number; zoom: number }>(`(() => {
		const m = document.querySelector('.board > g').transform.baseVal.consolidate().matrix;
		return {x:m.e,y:m.f,zoom:m.a};
	})()`);
}
async function nativeWheel(
	deltaY: number,
	precise = false,
	deltaX = 0,
	modifiers: MouseWheelInputEvent['modifiers'] = [],
) {
	const { x, y, cocoaPixelsPerTick } = navigationInput;
	win.webContents.sendInputEvent({ type: 'mouseMove', x, y });
	await new Promise((resolve) =>
		setTimeout(resolve, fixtureValues.windowSettleMs),
	);
	win.webContents.sendInputEvent({
		type: 'mouseWheel',
		x,
		y,
		deltaX,
		deltaY,
		modifiers,
		hasPreciseScrollingDeltas: precise,
		wheelTicksY: precise ? deltaY / cocoaPixelsPerTick : Math.sign(deltaY),
		wheelTicksX: precise ? deltaX / cocoaPixelsPerTick : Math.sign(deltaX),
	});
	await new Promise((resolve) =>
		setTimeout(resolve, fixtureValues.zoomSettleMs),
	);
}
async function nativePinch(scale: number) {
	await win.webContents.debugger.sendCommand('Input.synthesizePinchGesture', {
		x: navigationInput.x,
		y: navigationInput.y,
		scaleFactor: scale,
		gestureSourceType: 'mouse',
	});
	await new Promise((resolve) =>
		setTimeout(resolve, fixtureValues.zoomSettleMs),
	);
}
async function nativeZoomChecks() {
	win.webContents.debugger.attach('1.3');
	try {
		for (const mode of ['mouse', 'trackpad']) {
			await setControl('#navigation-mode', mode);
			if (mode !== 'trackpad') {
				await nativeWheelZoom();
				await capturedSmoothMouseZoom();
			}
			await pinchZoom(mode);
			for (const modifier of ['control', 'meta'] as const) {
				const before = await viewport();
				const delta = 10;
				await nativeWheel(delta, true, 0, [modifier]);
				assert.ok(
					(await viewport()).zoom > before.zoom,
					`${mode}: ${modifier}+wheel must zoom in`,
				);
				await nativeWheel(-delta, true, 0, [modifier]);
				assert.ok(
					Math.abs((await viewport()).zoom - before.zoom) <
						navigationInput.tolerance,
				);
			}
		}
		await setControl('#navigation-mode', 'trackpad');
		const before = await viewport();
		await nativeWheel(navigationInput.smallWheel, true);
		assert.equal(
			(await viewport()).zoom,
			before.zoom,
			'Trackpad mode must pan on a native trackpad',
		);
		assert.notEqual((await viewport()).y, before.y);
	} finally {
		win.webContents.debugger.detach();
	}
	console.log(
		'Native input: small mouse wheels, pinch in/out in all modes, Ctrl/Cmd+wheel, trackpad pan, fixed pointer anchor and unchanged app scale passed',
	);
}
async function capturedSmoothMouseZoom() {
	// Same deltas and wheel-tick ratio captured from the user's physical mouse.
	const captured = [
		{ x: 0, y: 1 },
		{ x: 0, y: 2 },
		{ x: 1, y: 6 },
		{ x: 2, y: 12 },
		{ x: 3, y: 13 },
		{ x: 3, y: 16 },
		{ x: 0, y: 13 },
	];
	for (const delta of captured) {
		const before = await viewport();
		await nativeWheel(-delta.y, true, -delta.x);
		assert.ok(
			(await viewport()).zoom < before.zoom,
			'Smooth physical mouse input must zoom out, including horizontal noise',
		);
		await nativeWheel(delta.y, true, delta.x);
		assert.ok(
			Math.abs((await viewport()).zoom - before.zoom) <
				navigationInput.tolerance,
			'Smooth physical mouse input must zoom back in',
		);
	}
}
async function nativeWheelZoom() {
	const wheelDeltas = { small: 3, medium: 40, large: 120 };
	for (const delta of Object.values(wheelDeltas)) {
		const before = await viewport();
		await nativeWheel(delta);
		assert.ok(
			(await viewport()).zoom > before.zoom,
			`Native wheel ${delta} must zoom in`,
		);
		await nativeWheel(-delta);
		assert.ok(
			Math.abs((await viewport()).zoom - before.zoom) <
				navigationInput.tolerance,
			'Reverse wheel must zoom back out',
		);
	}
}
async function pinchZoom(mode: string) {
	const before = await viewport();
	const anchor = await evaluate<{ x: number; y: number }>(`(() => {
		const r=document.querySelector('.board').getBoundingClientRect();
		return {x:${navigationInput.x}-r.left,y:${navigationInput.y}-r.top};
	})()`);
	await nativePinch(navigationInput.scale);
	const after = await viewport();
	assert.ok(
		Math.abs(after.zoom / before.zoom - navigationInput.scale) <
			navigationInput.tolerance,
		`${mode}: native pinch must scale the board with the gesture`,
	);
	for (const axis of ['x', 'y'] as const)
		assert.ok(
			Math.abs(
				(anchor[axis] - before[axis]) / before.zoom -
					(anchor[axis] - after[axis]) / after.zoom,
			) < navigationInput.tolerance,
			'Pinch must stay anchored to the pointer',
		);
	await nativePinch(1 / navigationInput.scale);
	assert.ok(
		Math.abs((await viewport()).zoom - before.zoom) < navigationInput.tolerance,
		`${mode}: reverse pinch must zoom back out`,
	);
	assert.equal(win.webContents.getZoomFactor(), 1);
	assert.equal(
		await evaluate('visualViewport.scale'),
		1,
		'Pinch must not magnify the app UI',
	);
}
async function verificationInteractions(expected: Buffer) {
	target = root;
	await click('[data-action="verify"]');
	await click('#verification-target');
	await until('!document.querySelector("#verification-target").disabled');
	assert.equal(
		await evaluate('document.querySelector("#run-checks").disabled'),
		true,
	);
	await setControl(
		'[aria-label="Approval reason"]',
		'Review deployment contract',
	);
	await evaluate(
		'document.querySelector("#verification input[placeholder]").dispatchEvent(new Event("input"))',
	);
	await click('#approve-baseline');
	await until('!document.querySelector("#approve-baseline").disabled');
	assert.equal(
		await evaluate('document.querySelector("#run-checks").disabled'),
		true,
		'Cancelled human approval must not enable execution',
	);
	approveContract = true;
	await click('#approve-baseline');
	await until('!document.querySelector("#run-checks").disabled');
	assert.ok(approvalReviews.at(-1)?.includes('scripts/prove-deployment.mjs'));
	await click('#run-checks');
	await until(
		'document.querySelector("#verification [role=status]").textContent === "Verified for this run"',
	);
	assert.deepEqual(
		await readFile(
			join(root, 'artifacts/contract-deployment/.tale/project.tale'),
		),
		expected,
	);
	assert.deepEqual(
		await readdir(join(root, 'artifacts/contract-deployment/.tale')),
		['project.tale'],
	);
	await evaluate(
		'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
	);
	await writeFile(
		join(root, 'artifacts/verification.png'),
		(await win.webContents.capturePage()).toPNG(),
	);
	await click('[aria-label="Close verification"]');
	await until('!document.querySelector("#verification")');
	// Editing the requirement in the real inspector invalidates approval.
	await evaluate(
		`(() => {const node=document.querySelector('[data-node="deployment-bytes"] .node-body');node.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:1}));node.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,pointerId:1}));})()`,
	);
	await setControl('[aria-label="Required behavior"]', 'exists');
	await click('[data-action="verify"]');
	await click('#verification-target');
	await until('!document.querySelector("#verification-target").disabled');
	assert.equal(
		await evaluate('document.querySelector("#run-checks").disabled'),
		true,
		'Changed agreement needs a new human approval',
	);
	await click('[aria-label="Close verification"]');
	await until('!document.querySelector("#verification")');
	await click('#undo');
	approveContract = false;
	approvalReviews = [];
	console.log(
		'Verification: human approval, real deployment evidence, JSON exclusion and changed-contract rejection passed',
	);
}
async function interactions() {
	const initial = await saveAs(join(directory, 'before-drag.json'));
	const original = initial.diagram.items.find((item) => item.id === 'meta');
	assert.ok(original);
	const originalZoom = initial.diagram.viewport.zoom;
	// Actual pointer input, not direct mutation of the editor's model.
	const before = await point('[data-node="meta"] .node-body');
	await drag(before, { x: before.x + 60, y: before.y + fixtureValues.moveY });
	await until('document.querySelector("#dirty").classList.contains("visible")');
	const moved = await saveAs(join(directory, 'moved.json'));
	const item = moved.diagram.items.find((i) => i.id === 'meta');
	assert.ok(item);
	assert.ok(
		Math.abs(item.position.x - (original.position.x + 60 / originalZoom)) < 2,
	);
	assert.ok(
		Math.abs(
			item.position.y -
				(original.position.y + fixtureValues.moveY / originalZoom),
		) < 2,
	);
	await evaluate(
		'(() => { const i = document.querySelector("input[aria-label=Title]"); i.value = "Edited project title"; i.dispatchEvent(new Event("change", {bubbles:true})); })()',
	);
	const edited = await saveAs(join(directory, 'edited.json'));
	assert.equal(
		edited.diagram.items.find((i) => i.id === 'meta')?.title,
		'Edited project title',
	);
	const resizeHandle = await point('[data-resize="meta"]');
	await drag(resizeHandle, {
		x: resizeHandle.x + fixtureValues.resizeX,
		y: resizeHandle.y + fixtureValues.resizeY,
	});
	const resized = await saveAs(join(directory, 'resized.json'));
	assert.ok(
		Math.abs(
			(resized.diagram.items.find((i) => i.id === 'meta')?.size.width ?? 0) -
				(original.size.width + fixtureValues.resizeX / originalZoom),
		) < 2,
	);
	await click('#arrow-tool');
	await drag(
		await point('[data-node="meta"] .node-body'),
		await point('[data-node="architecture"] .node-body'),
	);
	const connected = await saveAs(join(directory, 'connected.json'));
	const connection = connected.diagram.connections.at(-1);
	assert.ok(connection);
	assert.equal(connection.from, 'meta');
	assert.equal(connection.to, 'architecture');
	const bend = await point(
		`[data-edge="${connection.id}"][data-handle="bend"]`,
	);
	await drag(bend, { x: bend.x, y: bend.y + fixtureValues.moveY });
	const curved = await saveAs(join(directory, 'curved.json'));
	assert.ok(
		curved.diagram.connections.find((e) => e.id === connection.id)?.bend,
	);
	await drag(
		await point(`[data-edge="${connection.id}"][data-handle="to"]`),
		await point('[data-node="goal"] .node-body'),
	);
	const reconnected = await saveAs(join(directory, 'reconnected.json'));
	assert.equal(
		reconnected.diagram.connections.find((e) => e.id === connection.id)?.to,
		'goal',
	);
	const pathBeforeMove = await evaluate<string>(
		`document.querySelector('[data-edge="${connection.id}"] .edge-line').getAttribute('d')`,
	);
	const goal = await point('[data-node="goal"] .node-body');
	await drag(goal, {
		x: goal.x + fixtureValues.goalMoveX,
		y: goal.y + fixtureValues.goalMoveY,
	});
	const pathAfterMove = await evaluate<string>(
		`document.querySelector('[data-edge="${connection.id}"] .edge-line').getAttribute('d')`,
	);
	assert.notEqual(pathBeforeMove, pathAfterMove);
	// Freeform connections are saved, but have no Tale compilation semantics yet.
	// Reopen the valid diagram used before the connection interaction checks.
	openPath = join(directory, 'resized.json');
	await click('[data-action="open"]');

	await click('#project-settings');
	await evaluate(
		`Array.from(document.querySelectorAll('button')).find(b => b.textContent === '＋ Environment').click()`,
	);
	await evaluate(
		`(() => { const input = document.querySelector('input[aria-label="Environment name"]'); input.value = 'Staging'; input.dispatchEvent(new Event('change', {bubbles:true})); })()`,
	);
	await evaluate(
		`(() => { document.querySelector('input[aria-label="New tag name"]').value = 'Team agreement'; document.querySelector('input[aria-label="New tag identifier"]').value = 'AGREEMENT'; Array.from(document.querySelectorAll('button')).find(b => b.textContent === '＋ Add tag').click(); })()`,
	);
	const configured = await saveAs(join(directory, 'configured.json'));
	assert.equal(configured.environments[0]?.name, 'Staging');
	assert.ok(configured.itemTypes.some((t) => t.label === 'Team agreement'));
	await evaluate(
		`document.querySelector('[aria-label="AGREEMENT label"]').focus()`,
	);
	await writeFile(
		join(root, 'artifacts/tag-settings.png'),
		(await win.webContents.capturePage()).toPNG(),
	);
	await evaluate(
		`document.querySelector('#inspector .inspector-header button').click()`,
	);
	const zoomBeforeButton = (await viewport()).zoom;
	await click('#zoom-in');
	assert.equal(
		await evaluate('document.querySelector("#zoom").textContent'),
		`${Math.round(zoomBeforeButton * fixtureValues.buttonZoomStep * fixtureValues.percent)}%`,
	);
	await evaluate(
		'document.querySelector(".board").dispatchEvent(new WheelEvent("wheel", {deltaY:-50,clientX:400,clientY:350,ctrlKey:true,bubbles:true,cancelable:true}))',
	);
	await new Promise((resolve) =>
		setTimeout(resolve, fixtureValues.zoomSettleMs),
	);
	const zoomed = await saveAs(join(directory, 'zoomed.json'));
	assert.ok(
		zoomed.diagram.viewport.zoom >
			zoomBeforeButton * fixtureValues.buttonZoomStep,
	);
	await click('#fit');
	await evaluate('document.querySelector("#palette").open = true');
	assert.equal(
		await evaluate('document.querySelectorAll(".type-button").length'),
		fixtureValues.extendedTypeCount,
	);
	await click('.type-button[data-type-id="goal"]');
	const added = await saveAs(join(directory, 'added.json'));
	assert.equal(added.diagram.items.length, fixtureValues.extendedItemCount);
	await click('#undo');
	const undone = await saveAs(join(directory, 'undone.json'));
	assert.equal(undone.diagram.items.length, fixtureValues.originalItemCount);
	await click('#redo');
	const redone = await saveAs(join(directory, 'redone.json'));
	assert.equal(redone.diagram.items.length, fixtureValues.extendedItemCount);

	const deploy = join(directory, 'target');
	await mkdir(deploy);
	target = deploy;
	await writeFile(join(deploy, 'agents.md'), "Keep the user's rules.\n");
	await deployCurrent();
	const deployed = await saved(join(deploy, '.tale/project.tale'));
	assert.deepEqual(deployed, Buffer.from(compile(redone)[0]?.content ?? ''));
	assert.deepEqual(await readdir(join(deploy, '.tale')), ['project.tale']);

	await until(
		'document.querySelector("#status").textContent.includes("Deployed")',
	);
	const instructions = await readFile(join(deploy, 'agents.md'), 'utf8');
	await deployCurrent();
	await new Promise((resolve) =>
		setTimeout(resolve, fixtureValues.deploySettleMs),
	);
	assert.equal(await readFile(join(deploy, 'agents.md'), 'utf8'), instructions);
	assert.ok(instructions.startsWith("Keep the user's rules.\n"));
	assert.ok(instructions.includes('- "Staging":'));
	await deploymentChecks(deploy, instructions);
	openPath = undefined;
	await click('[data-action="open"]');
	await new Promise((resolve) =>
		setTimeout(resolve, fixtureValues.gestureSettleMs),
	);
	assert.equal(
		await evaluate('document.querySelectorAll(".node").length'),
		fixtureValues.extendedItemCount,
	);
	win.setSize(fixtureValues.smallWidth, fixtureValues.smallHeight);
	await new Promise((resolve) =>
		setTimeout(resolve, fixtureValues.windowSettleMs),
	);
	assert.equal(
		await evaluate(
			'document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth',
		),
		false,
	);
	await paletteViewportChecks();
	win.setSize(fixtureValues.largeWidth, fixtureValues.largeHeight);
	await new Promise((resolve) =>
		setTimeout(resolve, fixtureValues.windowSettleMs),
	);
	await paletteViewportChecks();
	const previousSave = await readFile(join(directory, 'redone.json'));
	await openNewProjectDialog();
	await setControl('#new-project input[name="title"]', 'My blank project');
	await submitNewProject();
	savePath = join(directory, 'new-project.json');
	await click('[data-action="save"]');
	const fresh = parseProject((await saved(savePath)).toString());
	assert.equal(fresh.name, 'My blank project');
	assert.equal(fresh.diagram.items.length, 0);
	assert.deepEqual(
		await readFile(join(directory, 'redone.json')),
		previousSave,
		'New must not overwrite the previous document',
	);
	await templateInteractions();
	// Reopen the original sample for a useful screenshot of the actual application.
	openPath = join(root, 'project/tale.project.json');
	await click('[data-action="open"]');
	await until('document.querySelectorAll(".node").length === 22');
	const product = await point('[data-node="product"] .node-body');
	await drag(product, product);
	await mkdir(join(root, 'artifacts'), { recursive: true });
	await writeFile(
		join(root, 'artifacts/editor.png'),
		(await win.webContents.capturePage()).toPNG(),
	);
	console.log(
		'Interactions: drag/resize, connect/bend/reconnect, attached arrows, title edit, zoom, palette, undo/redo, deployment, cancellation and viewport passed',
	);
}
async function paletteViewportChecks() {
	const toolbar = await evaluate(
		'document.querySelector(".tools").getBoundingClientRect().toJSON()',
	);
	const zoomExtremes = { in: 10000, out: -10000 };
	for (const delta of Object.values(zoomExtremes)) {
		await nativeWheel(delta);
		await evaluate('document.querySelector("#palette").open = true');
		assert.deepEqual(
			await evaluate(
				'document.querySelector(".tools").getBoundingClientRect().toJSON()',
			),
			toolbar,
			'Board zoom must not move or resize the toolbar',
		);
		assert.equal(
			await evaluate(`(() => {
			const canvas=document.querySelector('#canvas').getBoundingClientRect();
			const panel=document.querySelector('.palette-panel').getBoundingClientRect();
			return panel.left >= canvas.left && panel.right <= canvas.right && panel.top >= 0 && panel.bottom <= innerHeight;
		})()`),
			true,
			'The entire Add tag menu must remain inside the visible board and window',
		);
		assert.equal(
			await evaluate(`(() => {
			const list=document.querySelector('#type-list'); list.scrollTop=list.scrollHeight;
			return ['#type-search', '#manage-types', '.type-button:last-child'].every(selector => {
				const element=document.querySelector(selector), r=element.getBoundingClientRect();
				return element.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
			});
		})()`),
			true,
			'Search, the last tag, and Manage types must all remain reachable',
		);
		await evaluate('document.querySelector("#palette").open = false');
	}
	await click('#fit');
	await evaluate('document.querySelector("#palette").open = true');
	await evaluate(
		'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
	);
	await writeFile(
		join(root, 'artifacts/tag-menu.png'),
		(await win.webContents.capturePage()).toPNG(),
	);
	await evaluate('document.querySelector("#palette").open = false');
	console.log(
		'Tag menu: on-screen bounds and reachable controls at minimum/maximum board zoom passed',
	);
}
async function deploymentChecks(destination: string, instructions: string) {
	await deploymentPreview();
	await click('[aria-label="Claude Code"]');
	await until(
		'document.querySelectorAll(".deployment-preview details").length === 3',
	);
	assert.equal(
		await evaluate('document.querySelector("#confirm-deployment").disabled'),
		true,
	);
	assert.equal(
		await evaluate(`(() => {
 const control = document.querySelector('.deployment-overwrite');
 const r = control.getBoundingClientRect();
 return r.top >= 0 && r.bottom <= innerHeight && control.checkVisibility();
})()`),
		true,
		'Overwrite confirmation must be visible without scrolling',
	);
	await mkdir(join(root, 'artifacts'), { recursive: true });
	await writeFile(
		join(root, 'artifacts/deployment.png'),
		(await win.webContents.capturePage()).toPNG(),
	);
	await click('[aria-label="Close deployment"]');
	await until('!document.querySelector("#deployment")');
	assert.equal(
		await readFile(join(destination, 'agents.md'), 'utf8'),
		instructions,
	);
	assert.ok(!(await readdir(destination)).includes('CLAUDE.md'));
	await deploymentPreview();
	await click('[aria-label="Claude Code"]');
	await until(
		'document.querySelectorAll(".deployment-preview details").length === 3',
	);
	await click('[aria-label="Overwrite existing Tale deployment"]');
	await click('#confirm-deployment');
	await until('!document.querySelector("#deployment")');
	assert.ok(
		(await readFile(join(destination, 'CLAUDE.md'), 'utf8')).includes(
			'@.tale/project.tale',
		),
	);
	const replay = await evaluate<{ ok: boolean }>(
		'window.tale.deploy("invalid-token",true)',
	);
	assert.equal(
		replay.ok,
		false,
		'Deployment requires the current preview token',
	);
	target = undefined;
	await click('[data-action="deploy"]');
	await click('[aria-label="Choose project folder"]');
	await until('!document.querySelector(".deployment-folder button").disabled');
	assert.equal(
		await evaluate('document.querySelector("#confirm-deployment").disabled'),
		true,
	);
	await click('[aria-label="Close deployment"]');
	await until('!document.querySelector("#deployment")');
	target = destination;
}
async function setControl(selector: string, value: string) {
	await evaluate(
		`(() => {const input=document.querySelector(${JSON.stringify(selector)}); if(!input)throw new Error('Missing input'); input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
	);
}
async function addCustomSection(type: string, title: string): Promise<string> {
	await click('[aria-label="Add section"]');
	await click(`[aria-label="Add ${type}"]`);
	const id = await evaluate<string>(
		'document.querySelector(".custom-section:last-of-type")?.dataset.section || Array.from(document.querySelectorAll(".custom-section")).at(-1).dataset.section',
	);
	const selector = `[data-section="${id}"]`;
	await setControl(`${selector} [aria-label="Section title"]`, title);
	return selector;
}
async function dismissPicker() {
	await click('[aria-label="Add section"]');
	await until(
		'document.querySelector(".section-picker-panel").matches(":popover-open")',
	);
	const outside = await point('.brand');
	win.webContents.sendInputEvent({
		type: 'mouseDown',
		button: 'left',
		clickCount: 1,
		...outside,
	});
	win.webContents.sendInputEvent({
		type: 'mouseUp',
		button: 'left',
		clickCount: 1,
		...outside,
	});
	await until(
		'!document.querySelector(".section-picker-panel").matches(":popover-open")',
	);
	await click('[aria-label="Add section"]');
	win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
	win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
	await until(
		'!document.querySelector(".section-picker-panel").matches(":popover-open")',
	);
}
async function customSectionInteractions(original: Buffer) {
	const goal = await point('[data-node="goal"] .node-body');
	await drag(goal, goal);
	await dismissPicker();
	const text = await addCustomSection('Free text', 'Communication');
	await setControl(`${text} textarea`, 'Discuss first.\nKeep changes small.');
	const boxes = await addCustomSection('Checkboxes', 'Allowed tools');
	await setControl(
		`${boxes} .section-option:first-child [aria-label="Option label"]`,
		'TypeScript',
	);
	await setControl(
		`${boxes} .section-option:last-child [aria-label="Option label"]`,
		'Biome',
	);
	await click(`${boxes} [aria-label="Select TypeScript"]`);
	await click(`${boxes} [aria-label="Select Biome"]`);
	const radio = await addCustomSection('Radio buttons', 'Approval');
	await setControl(
		`${radio} .section-option:first-child [aria-label="Option label"]`,
		'Required',
	);
	await setControl(
		`${radio} .section-option:last-child [aria-label="Option label"]`,
		'Optional',
	);
	await click(`${radio} [aria-label="Select Optional"]`);
	await click(`${radio} [aria-label="Select Required"]`);
	assert.equal(
		await evaluate(
			`document.querySelectorAll('${radio} input[type="radio"]:checked').length`,
		),
		1,
	);
	await click(`${text} [aria-label="Duplicate Communication"]`);
	const copy = await evaluate<string>(
		`document.querySelector('${text}').nextElementSibling.dataset.section`,
	);
	await setControl(`[data-section="${copy}"] textarea`, 'Independent copy');
	assert.equal(
		await evaluate(`document.querySelector('${text} textarea').value`),
		'Discuss first.\nKeep changes small.',
	);
	await click(`[data-section="${copy}"] [aria-label="Delete Communication"]`);
	const file = join(directory, 'custom-sections.json');
	const project = await saveAs(file);
	const sections = project.diagram.items.find(
		(item) => item.id === 'goal',
	)?.sections;
	assert.ok(sections);
	assert.deepEqual(
		sections.map((section) => section.type),
		['text', 'checkboxes', 'radio'],
	);
	const block = [
		'  section "Communication" type=text',
		'    text "Discuss first.\\nKeep changes small."',
		'  section "Allowed tools" type=checkboxes',
		'    selected "TypeScript" "Biome"',
		'  section "Approval" type=radio',
		'    selected "Required"',
	].join('\n');
	const expected = Buffer.from(
		original.toString().replace('\n\nPRODUCT', `\n${block}\n\nPRODUCT`),
	);
	const targetDir = join(directory, 'custom-export');
	await mkdir(targetDir);
	await compileAndExport(targetDir, expected);
	openPath = file;
	await click('[data-action="open"]');
	await compileAndExport(targetDir, expected);
	const reopened = await saveAs(join(directory, 'custom-reopened.json'));
	assert.deepEqual(reopened, project);
	target = targetDir;
	await deployCurrent();
	assert.deepEqual(
		await saved(join(targetDir, '.tale/project.tale')),
		expected,
	);
	assert.deepEqual(await readdir(join(targetDir, '.tale')), ['project.tale']);

	const reopenedGoal = await point('[data-node="goal"] .node-body');
	await drag(reopenedGoal, reopenedGoal);
	await evaluate(
		`for(const section of document.querySelectorAll('.custom-section'))section.open=true`,
	);
	await writeFile(
		join(root, 'artifacts/editor.png'),
		(await win.webContents.capturePage()).toPNG(),
	);
	await click('[aria-label="Add section"]');
	await writeFile(
		join(root, 'artifacts/section-picker.png'),
		(await win.webContents.capturePage()).toPNG(),
	);
	win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
	win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
	console.log(
		'Custom sections: all three types, editable options, radio exclusivity, duplication, popup dismissal, JSON roundtrip, deployment and exact exports passed',
	);
}
async function predefinedTagInteractions(originalTypeId: string) {
	await click('[aria-label="Save as predefined tag"]');
	const savedPath = join(directory, 'predefined-tag.json');
	const project = await saveAs(savedPath);
	const preset = project.itemTypes.at(-1)!;
	assert.notEqual(preset.id, originalTypeId);
	assert.equal(
		preset.definition?.initial?.sections[0]?.title,
		'Team communication',
	);
	openPath = savedPath;
	await click('[data-action="open"]');
	await click('#palette > summary');
	await click(`.type-button[data-type-id="${preset.id}"]`);
	const copy = await saveAs(join(directory, 'predefined-copy.json'));
	const item = copy.diagram.items.at(-1)!;
	assert.equal(item.sections?.[0]?.type, 'text');
	assert.equal(
		item.sections?.[0]?.type === 'text' ? item.sections[0].text : '',
		'Ask before expanding scope.',
	);
	assert.notEqual(
		item.sections?.[0]?.id,
		preset.definition?.initial?.sections[0]?.id,
	);
	await setControl('#inspector textarea', 'Independent copy.');
	const edited = await saveAs(join(directory, 'predefined-edited.json'));
	const source = edited.itemTypes.find((tag) => tag.id === preset.id)
		?.definition?.initial?.sections[0];
	assert.equal(
		source?.type === 'text' ? source.text : '',
		'Ask before expanding scope.',
	);
	// Keep the authored tag and catalogue entry, removing only the extra copy from the test board.
	await click('[aria-label="Delete tag"]');
	const original = edited.diagram.items.find(
		(item) => item.typeId === originalTypeId,
	)!;
	await evaluate(
		`(() => { const node = document.querySelector('[data-node="${original.id}"] .node-body'); node.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:1})); node.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,button:0,pointerId:1})); })()`,
	);
}
async function customTagInteractions(original: Buffer) {
	await click('#project-settings');
	await setControl('[aria-label="New tag name"]', 'Team rules');
	await setControl('[aria-label="New tag identifier"]', 'TEAM_RULES');
	await evaluate(
		`Array.from(document.querySelectorAll('button')).find(b => b.textContent === '＋ Add tag').click()`,
	);
	const configured = await saveAs(
		join(directory, 'custom-tag-configured.json'),
	);
	const type = configured.itemTypes.find((type) => type.tag === 'TEAM_RULES');
	assert.ok(type, 'Users must be able to define a new tag');
	await click('[aria-label="Close inspector"]');
	await click('#palette > summary');
	await click(`.type-button[data-type-id="${type.id}"]`);
	const text = await addCustomSection('Free text', 'Team communication');
	await setControl(`${text} textarea`, 'Ask before expanding scope.');
	await predefinedTagInteractions(type.id);
	const added = await saveAs(join(directory, 'custom-tag-added.json'));
	const item = added.diagram.items.find((item) => item.typeId === type.id);
	assert.ok(item);
	await click('[aria-label="Close inspector"]');
	await click('#fit');
	await click('#arrow-tool');
	await drag(
		await point('[data-node="project"] .node-body'),
		await point(`[data-node="${item.id}"] .node-body`),
	);
	const file = join(directory, 'custom-tag-connected.json');
	const connected = await saveAs(file);
	assert.ok(
		connected.diagram.connections.some(
			(edge) =>
				edge.from === 'project' &&
				edge.to === item.id &&
				edge.kind === 'contains',
		),
	);
	const expected = Buffer.from(
		`${original.toString()}\nTEAM_RULES\n  section "Team communication" type=text\n    text "Ask before expanding scope."\n`,
	);
	const destination = join(directory, 'custom-tag-export');
	await mkdir(destination);
	await compileAndExport(destination, expected);
	openPath = file;
	await click('[data-action="open"]');
	await compileAndExport(destination, expected);
	assert.deepEqual(
		await saveAs(join(directory, 'custom-tag-reopened.json')),
		connected,
	);
	target = destination;
	await deployCurrent();
	assert.deepEqual(
		await readFile(join(destination, '.tale/project.tale')),
		expected,
	);
	assert.deepEqual(await readdir(join(destination, '.tale')), ['project.tale']);
	openPath = join(root, 'project/tale.project.json');
	await click('[data-action="open"]');
	console.log(
		'Custom tags: define, add, connect, edit, save/reopen and byte-exact deployment passed',
	);
}
void app
	.whenReady()
	.then(async () => {
		directory = await mkdtemp(join(tmpdir(), 'tale-e2e-'));
		const expected = await readFile(join(root, '.tale/project.tale'));
		await session(1, expected);
		await session(2, expected);
		await rm(directory, { recursive: true, force: true });
		win = await createWindow(root, {
			hidden: false,
			dialogs,
			preferencesPath: join(directory, 'file-dialogs.json'),
			approvalStore: join(directory, 'trusted-approvals'),
			confirmApproval: (details) => {
				approvalReviews.push(details);
				return Promise.resolve(approveContract);
			},
		});
		await until('document.body.dataset.ready === "true"');
		await evaluate('window.tale.setDirty(true)');
		discard = false;
		await click('#file-menu [data-action="exit"]');
		assert.equal(
			win.isDestroyed(),
			false,
			'Cancelled File Exit keeps unsaved work',
		);
		await click('.appbar > [data-action="exit"]');
		assert.equal(
			win.isDestroyed(),
			false,
			'Cancelled exit icon keeps unsaved work',
		);
		win.close();
		await new Promise((resolve) =>
			setTimeout(resolve, fixtureValues.windowSettleMs),
		);
		assert.equal(win.isDestroyed(), false, 'Cancel must preserve the window');
		discard = true;
		app.removeListener('window-all-closed', keepAliveBetweenSessions);
		quitWhenWindowsClose();
		app.once('before-quit', () => {
			assert.equal(win.isDestroyed(), true);
			accepted = true;
			console.log(
				'Lifecycle: closing the last window exits the app; cancel preserves unsaved work',
			);
		});
		win.webContents.send('tale:menu', 'exit');
	})
	.catch(async (error) => {
		console.error(error);
		if (win && !win.isDestroyed()) {
			await mkdir(join(root, 'artifacts'), { recursive: true });
			await writeFile(
				join(root, 'artifacts/failure.png'),
				(await win.webContents.capturePage()).toPNG(),
			);
		}
		app.exit(1);
	});

async function openNewProjectDialog() {
	await evaluate('document.querySelector(\'[data-action="new"]\').click()');
	await until(
		'document.querySelectorAll(\'#new-project select[name="template"] option\').length === 4',
	);
}
async function submitNewProject() {
	await evaluate(
		'document.querySelector(\'#new-project button[type="submit"]\').click()',
	);
	await until(
		'!document.querySelector("#new-project") && document.body.dataset.busy !== "true"',
	);
}
async function templateInteractions() {
	await openNewProjectDialog();
	await setControl('#new-project input[name="title"]', 'Cancelled project');
	await evaluate(
		'document.querySelector(\'[aria-label="Close new project"]\').click()',
	);
	await until(
		'!document.querySelector("#new-project") && document.body.dataset.busy !== "true"',
	);
	assert.equal(
		await evaluate('document.querySelector("#project-name").textContent'),
		'My blank project',
	);
	const suggestion = join(directory, 'not-created-yet');
	for (const template of [
		'node-typescript-eslint-webpack',
		'node-typescript-biome-webpack',
		'rust-clippy',
	]) {
		await openNewProjectDialog();
		await setControl('#new-project input[name="title"]', template);
		await setControl('#new-project input[name="directory"]', suggestion);
		await setControl(
			'#new-project select[name="template"]',
			`${template}.json`,
		);
		await evaluate(
			'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
		);
		await writeFile(
			join(root, 'artifacts/new-project.png'),
			(await win.webContents.capturePage()).toPNG(),
		);
		await submitNewProject();
		assert.equal(
			await evaluate(
				'document.querySelector("#dirty").classList.contains("visible")',
			),
			true,
		);
		const file = join(directory, `${template}.json`);
		const project = await saveAs(file);
		const bytes = await readFile(file);
		assert.equal(project.name, template);
		assert.equal(project.deploymentDirectory, suggestion);
		assert.ok(project.diagram.items.length);
		const expected = Buffer.from(compile(project)[0]!.content);
		openPath = file;
		await click('[data-action="open"]');
		target = join(directory, `${template}-deployed`);
		await mkdir(target);
		const before = targetSuggestions.length;
		await deployCurrent();
		assert.equal(
			targetSuggestions.length,
			before + 1,
			'Deployment must ask for a directory even with a saved suggestion',
		);
		assert.equal(targetSuggestions.at(-1), suggestion);
		assert.deepEqual(
			await readFile(join(target, '.tale/project.tale')),
			expected,
		);
		assert.deepEqual(await readdir(join(target, '.tale')), ['project.tale']);
		assert.match(
			await readFile(join(target, 'AGENTS.md'), 'utf8'),
			/project.tale/,
		);
		assert.deepEqual(
			await readFile(file),
			bytes,
			'Deployment must preserve the saved diagram',
		);
		await deployCurrent();
		assert.equal(
			targetSuggestions.length,
			before + 2,
			'Repeat deployment must ask again',
		);
		assert.deepEqual(
			await readFile(join(target, '.tale/project.tale')),
			expected,
		);
	}
	const invalid = await evaluate<{ ok: boolean }>(
		`window.tale.newProject({templateId: '../project/tale.project.json', title: 'Invalid'})`,
	);
	assert.equal(invalid.ok, false);
	assert.equal(
		await evaluate('document.querySelector("#project-name").textContent'),
		'rust-clippy',
	);
	await evaluate('window.tale.setDirty(true)');
	discard = false;
	await openNewProjectDialog();
	await setControl(
		'#new-project input[name="title"]',
		'Must not replace unsaved work',
	);
	await evaluate(
		'document.querySelector(\'#new-project button[type="submit"]\').click()',
	);
	await until(
		'!document.querySelector(\'#new-project button[type="submit"]\').disabled',
	);
	assert.equal(
		await evaluate('document.querySelector("#project-name").textContent'),
		'rust-clippy',
	);
	await evaluate(
		'document.querySelector(\'[aria-label="Close new project"]\').click()',
	);
	await until('document.body.dataset.busy !== "true"');
	discard = true;
	console.log(
		'New project: all templates, cancellation, Save/Open, destination confirmation and deterministic deployment passed',
	);
}
