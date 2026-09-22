import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app, type BrowserWindow } from 'electron';
import { compile } from '../src/application/compiler.js';
import { createWindow, type FileDialogs } from '../src/main/window.js';
import { parseProject } from '../src/model/project.js';

let window: BrowserWindow;
let directory = '';
let openPath: string | undefined;
let savePath: string | undefined;
let target: string | undefined;
const dialogs: FileDialogs = {
	open: () => Promise.resolve(openPath),
	save: () => Promise.resolve(savePath),
	target: () => Promise.resolve(target),
	discard: () => Promise.resolve(true),
};
const wait = { timeoutMs: 10000, intervalMs: 30 };
const minimumWindowSize = { width: 900, height: 640 };
function evaluate<T>(script: string): Promise<T> {
	return window.webContents.executeJavaScript(script, true) as Promise<T>;
}
async function until(script: string) {
	const deadline = Date.now() + wait.timeoutMs;
	while (Date.now() < deadline) {
		if (await evaluate<boolean>(script)) return;
		await new Promise((resolve) => setTimeout(resolve, wait.intervalMs));
	}
	throw new Error(`Timed out: ${script}`);
}
async function click(selector: string) {
	await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
	await until('document.body.dataset.busy !== "true"');
}
async function change(selector: string, value: string) {
	await evaluate(
		`(() => { const input = document.querySelector(${JSON.stringify(selector)}); input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event('change', { bubbles: true })); })()`,
	);
}
async function saveAs(path: string) {
	savePath = path;
	await click('[data-action="saveAs"]');
	await until(
		'!document.querySelector("#dirty").classList.contains("visible")',
	);
	return parseProject(await readFile(path, 'utf8'));
}
async function run() {
	directory = await mkdtemp(join(tmpdir(), 'tale-v2-e2e-'));
	window = await createWindow(process.cwd(), {
		dialogs,
		preferencesPath: join(directory, 'preferences.json'),
	});
	window.setIgnoreMouseEvents(true);
	await until('document.body.dataset.ready === "true"');
	assert.equal(await evaluate('document.querySelectorAll(".node").length'), 0);
	assert.equal(
		await evaluate('document.querySelector("#library-settings").disabled'),
		false,
	);
	await click('#library-settings');
	await until('document.querySelector("#definitions-dialog")?.open');
	const tagNames = await evaluate<string[]>(
		`[...document.querySelectorAll('#definitions-dialog .definition-row')].map(row => row.textContent.trim())`,
	);
	assert.deepEqual(
		tagNames,
		[...tagNames].sort((a, b) => a.localeCompare(b)),
	);
	await evaluate(`(() => {
		const search = document.querySelector('#definitions-dialog .definitions-search');
		search.value = 'scope';
		search.dispatchEvent(new Event('input', { bubbles: true }));
	})()`);
	assert.deepEqual(
		await evaluate<string[]>(
			`[...document.querySelectorAll('#definitions-dialog .definition-row')].map(row => row.textContent.trim())`,
		),
		['Scope'],
	);
	await evaluate(`(() => {
		const search = document.querySelector('#definitions-dialog .definitions-search');
		search.value = '';
		search.dispatchEvent(new Event('input', { bubbles: true }));
	})()`);
	await click('#definitions-dialog .definition-row');
	assert.equal(
		await evaluate(
			'document.querySelector("#definitions-dialog .definition-row").getAttribute("aria-current")',
		),
		'true',
	);
	const { width: originalWidth, height: originalHeight } = window.getBounds();
	window.setSize(minimumWindowSize.width, minimumWindowSize.height);
	const dialogFits = await evaluate<boolean>(`(() => {
		const dialog = document.querySelector('#definitions-dialog').getBoundingClientRect();
		const title = document.querySelector('#definitions-dialog h2').getBoundingClientRect();
		return dialog.left >= 0 && dialog.top >= 0 &&
			dialog.right <= innerWidth && dialog.bottom <= innerHeight &&
			title.left >= dialog.left && title.top >= dialog.top;
	})()`);
	assert.equal(
		dialogFits,
		true,
		'Library title and dialog stay in the minimum-size window',
	);
	window.setSize(originalWidth, originalHeight);
	await evaluate(
		'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
	);
	const listScroll = await evaluate<number>(`(() => {
		const list = document.querySelector('#definitions-dialog .definitions-list');
		list.scrollTop = list.scrollHeight;
		return list.scrollTop;
	})()`);
	assert.ok(listScroll > 0, 'The Tag list is scrollable');
	await click('#definitions-dialog .definition-row:last-child');
	assert.equal(
		await evaluate(
			'document.querySelector("#definitions-dialog .definitions-list").scrollTop',
		),
		listScroll,
		'Selecting a Tag keeps the list at its scroll position',
	);
	assert.equal(
		await evaluate(
			'document.querySelector("#definitions-dialog .definition-row:last-child").getAttribute("aria-current")',
		),
		'true',
	);
	await click('#definitions-dialog .definition-row');
	assert.equal(
		await evaluate(
			'document.querySelectorAll("#definitions-dialog textarea").length',
		),
		1,
	);
	await click('#definitions-dialog [aria-label="Close Tags and skills"]');
	assert.equal(
		await evaluate(
			'document.querySelector(".appbar > [data-action=deploy]").disabled',
		),
		true,
	);
	openPath = join(process.cwd(), 'project/tale.project.json');
	await click('[data-action="open"]');
	await until('document.querySelectorAll(".node").length > 0');
	assert.equal(
		await evaluate(
			'Boolean(document.querySelector("#type-list [data-type-id=editor]"))',
		),
		false,
	);
	assert.ok(
		(await evaluate<number>('document.querySelectorAll(".edge").length')) > 0,
		'The example opens with its connected diagram',
	);
	const itemCount = await evaluate<number>(
		'document.querySelectorAll(".node").length',
	);
	await evaluate(`(() => {
		const node = document.querySelector('[data-node] .node-body');
		node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 }));
		node.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 }));
	})()`);
	window.webContents.copy();
	window.webContents.paste();
	await until(`document.querySelectorAll('.node').length === ${itemCount + 1}`);
	await click('#undo');
	assert.equal(
		await evaluate<number>('document.querySelectorAll(".node").length'),
		itemCount,
	);
	const browserFixture = parseProject(
		await readFile('project/tale.project.json', 'utf8'),
	);
	await evaluate(`(async () => {
		const project = ${JSON.stringify(browserFixture)};
		for (const [path, needsProject] of [
			['../editor/navigation.test.js', false],
			['../svg/scene.test.js', false],
			['./icons.test.js', false],
			['../editor/editor.test.js', true],
			['./deployment.test.js', true],
			['./new-project.test.js', true],
			['./app.test.js', false],
		]) {
			const test = await import(path);
			await test.run(needsProject ? project : undefined);
		}
	})()`);
	await click('#library-settings');
	await until('document.querySelector("#definitions-dialog")?.open');
	assert.equal(
		await evaluate(
			'document.querySelectorAll("#definitions-dialog textarea").length',
		),
		1,
	);
	await click('#definitions-dialog .definition-row');
	assert.equal(
		await evaluate(
			'document.querySelectorAll("#definitions-dialog textarea").length',
		),
		1,
	);
	assert.equal(
		await evaluate(
			'document.querySelectorAll("#definitions-dialog input[type=radio], #definitions-dialog input[type=checkbox]").length',
		),
		0,
	);
	await change('#definitions-dialog textarea', 'Deny unrelated changes.');
	await click('#definitions-dialog .manager-tabs button:nth-child(2)');
	const skillNames = await evaluate<string[]>(
		`[...document.querySelectorAll('#definitions-dialog .definition-row')].map(row => row.textContent.trim())`,
	);
	assert.deepEqual(
		skillNames,
		[...skillNames].sort((a, b) => a.localeCompare(b)),
	);
	assert.equal(
		await evaluate(
			'Boolean([...document.querySelectorAll("#definitions-dialog .definition-row")].find(row => row.textContent.trim() === "Skill"))',
		),
		false,
	);
	const skillListScroll = await evaluate<number>(`(() => {
		const list = document.querySelector('#definitions-dialog .definitions-list');
		list.scrollTop = list.scrollHeight;
		return list.scrollTop;
	})()`);
	assert.ok(skillListScroll > 0, 'The Skill list is scrollable');
	await click('#definitions-dialog .definition-row:last-child');
	assert.equal(
		await evaluate(
			'document.querySelector("#definitions-dialog .definitions-list").scrollTop',
		),
		skillListScroll,
		'Selecting a Skill keeps the list at its scroll position',
	);
	await click('#definitions-dialog .definition-row');
	assert.equal(
		await evaluate(
			'document.querySelectorAll("#definitions-dialog textarea").length',
		),
		1,
	);
	await click('#definitions-dialog [aria-label="Close Tags and skills"]');
	await click('#palette summary');
	assert.match(
		await evaluate<string>(
			'document.querySelector("#type-list .type-info").title',
		),
		/Deny unrelated changes\./,
	);
	await click('#type-list .type-info');
	assert.equal(
		await evaluate('document.querySelector("#definitions-dialog")?.open'),
		true,
	);
	assert.equal(
		await evaluate(
			'document.querySelectorAll("#definitions-dialog textarea").length',
		),
		1,
	);
	await click('#definitions-dialog [aria-label="Close Tags and skills"]');
	await evaluate(
		'document.querySelector("[data-node] .node-body").dispatchEvent(new PointerEvent("pointerdown", { bubbles:true,button:0,pointerId:1 }))',
	);
	await evaluate(
		'document.querySelector("[data-node] .node-body").dispatchEvent(new PointerEvent("pointerup", { bubbles:true,button:0,pointerId:1 }))',
	);
	assert.equal(
		await evaluate('document.querySelectorAll("#inspector textarea").length'),
		1,
	);
	assert.equal(
		await evaluate(
			'document.querySelectorAll("#inspector input[type=radio], #inspector input[type=checkbox], #inspector .section-toolbar").length',
		),
		0,
	);
	await change(
		'#inspector textarea',
		'Build a clear, human-language Tale editor.',
	);
	const saved = await saveAs(join(directory, 'edited.json'));
	assert.equal(saved.formatVersion, 2);
	await click('#file-menu summary');
	await until(
		'document.querySelectorAll("#recent-project-list button").length === 2',
	);
	const recent = await evaluate<string[]>(
		`[...document.querySelectorAll('#recent-project-list button')].map(button => button.title)`,
	);
	assert.ok(recent[0]?.endsWith('edited.json'));
	assert.equal(new Set(recent).size, recent.length);
	openPath = undefined;
	await click('#recent-project-list button');
	await until(
		'!document.querySelector("#dirty").classList.contains("visible")',
	);
	assert.ok(saved.diagram.connections.length > 0);
	assert.equal(
		saved.diagram.items[0]?.text,
		'Build a clear, human-language Tale editor.',
	);
	const first = compile(saved)[0]?.content;
	assert.ok(first?.includes('Build a clear, human-language Tale editor.'));
	assert.ok(first?.includes('Product guides Architecture.'));
	assert.deepEqual(
		compile(parseProject(await readFile(savePath!, 'utf8')))[0]?.content,
		first,
	);
	await click('[data-action="compile"]');
	assert.equal(
		await evaluate('document.querySelector("#compiled-output").value'),
		first,
	);
	await click('#close-preview');
	target = join(directory, 'destination');
	await import('node:fs/promises').then(({ mkdir }) => mkdir(target!));
	await click('.appbar > [data-action="deploy"]');
	await until(
		'!document.querySelector("#deployment [aria-label=\\"Choose project folder\\"]").disabled',
	);
	await click('[aria-label="Choose project folder"]');
	await until('!document.querySelector("#confirm-deployment").disabled');
	await click('#confirm-deployment');
	await until(
		'document.querySelector("#deployment .deployment-progress")?.textContent?.includes("Deployment complete")',
	);
	assert.equal(
		await evaluate('document.querySelector("#deployment progress").value'),
		2,
	);
	await click('#deployment .dialog-footer button');
	await until('!document.querySelector("#deployment")');
	const deployedTarget = target;
	target = undefined;
	openPath = join(process.cwd(), 'project/tale.project.json');
	await click('[data-action="open"]');
	await click('.appbar > [data-action="deploy"]');
	await until(
		'!document.querySelector("#deployment [aria-label=\\"Choose project folder\\"]").disabled',
	);
	assert.equal(
		await evaluate(
			'document.querySelector("#deployment .deployment-preview").childElementCount',
		),
		0,
		'A different project must not reuse the previous destination',
	);
	await click('#deployment [aria-label="Close deployment"]');
	await until('!document.querySelector("#deployment")');
	openPath = savePath;
	await click('[data-action="open"]');
	await click('.appbar > [data-action="deploy"]');
	await until(
		'document.querySelector("#deployment .deployment-preview")?.textContent?.includes("Already up to date")',
	);
	assert.equal(
		await evaluate(
			'document.querySelector("#deployment .deployment-folder").textContent.includes("destination")',
		),
		true,
	);
	assert.equal(
		await evaluate(
			'document.querySelector("#deployment #confirm-deployment").disabled',
		),
		true,
	);
	assert.equal(
		await evaluate(
			'document.querySelector("#deployment .deployment-overwrite").hidden',
		),
		true,
	);
	await click('#deployment [aria-label="Close deployment"]');
	await until('!document.querySelector("#deployment")');
	assert.ok(deployedTarget);
	assert.equal(
		await readFile(join(deployedTarget, '.tale/project.tale'), 'utf8'),
		first,
	);
	assert.deepEqual(await readdir(join(deployedTarget, '.tale')), [
		'project.tale',
	]);
	assert.match(
		await readFile(join(deployedTarget, 'AGENTS.md'), 'utf8'),
		/project\.tale/,
	);
	assert.equal(
		await evaluate(
			'document.querySelector("#status .status-message")?.textContent?.length > 0',
		),
		true,
	);
	await click('#status [aria-label="Dismiss message"]');
	assert.equal(
		await evaluate(
			'document.querySelector("#status").classList.contains("visible")',
		),
		false,
	);
	window.close();
	await new Promise<void>((resolve) => window.once('closed', () => resolve()));
	await rm(directory, { recursive: true, force: true });
	console.log(
		'Human-language editor, JSON roundtrip, deterministic Tale output, and deployment passed',
	);
}
void app
	.whenReady()
	.then(run)
	.then(() => app.quit())
	.catch((error) => {
		console.error(error);
		app.exit(1);
	});
