import {
	resolveAgentLocation,
	safeRelativePath,
} from '../application/agent-integration.js';
import { compile } from '../application/compiler.js';
import {
	createDeploymentChanges,
	type DeploymentChange,
} from '../application/deployment.js';
import type { Bridge, MenuAction, Reply } from '../model/bridge.js';
import {
	type AgentSelection,
	type DeploymentPreview,
	type DeploymentProgress,
	type ReferencePlacement,
	requiresTaleOverwrite,
	validateAgentSelection,
	validateReferencePlacement,
} from '../model/deployment.js';
import {
	fromTemplate,
	type NewProjectRequest,
	newProject,
	type TemplateSummary,
	validateNewProject,
} from '../model/new-project.js';
import {
	MAX_PROJECT_BYTES,
	type Project,
	parseProject,
	serializeProject,
	validateProject,
} from '../model/project.js';

interface WritableFile {
	write(data: string): Promise<void>;
	close(): Promise<void>;
}
interface BrowserFileHandle {
	kind: 'file';
	name: string;
	getFile(): Promise<File>;
	createWritable(): Promise<WritableFile>;
	queryPermission?(options: {
		mode: 'read' | 'readwrite';
	}): Promise<PermissionState>;
	requestPermission?(options: {
		mode: 'read' | 'readwrite';
	}): Promise<PermissionState>;
}
interface BrowserDirectoryHandle {
	kind: 'directory';
	name: string;
	getFileHandle(
		name: string,
		options?: { create?: boolean },
	): Promise<BrowserFileHandle>;
	getDirectoryHandle(
		name: string,
		options?: { create?: boolean },
	): Promise<BrowserDirectoryHandle>;
	removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
	queryPermission?(options: {
		mode: 'read' | 'readwrite';
	}): Promise<PermissionState>;
	requestPermission?(options: {
		mode: 'read' | 'readwrite';
	}): Promise<PermissionState>;
}
interface PickerWindow extends Window {
	showOpenFilePicker?(options?: object): Promise<BrowserFileHandle[]>;
	showSaveFilePicker?(options?: object): Promise<BrowserFileHandle>;
	showDirectoryPicker?(options?: object): Promise<BrowserDirectoryHandle>;
}
interface BrowserPlan {
	preview: DeploymentPreview;
	directory: BrowserDirectoryHandle;
	changes: DeploymentChange[];
}

const databaseName = 'tale-browser';
const storeName = 'values';
const recentKey = 'recent-projects';
const maxRecent = 10;

function picker(): PickerWindow {
	return window as PickerWindow;
}
function cancelled(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'AbortError';
}
async function database(): Promise<IDBDatabase> {
	return await new Promise((resolve, reject) => {
		const request = indexedDB.open(databaseName, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(storeName);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}
async function stored<T>(key: string): Promise<T | undefined> {
	const db = await database();
	try {
		return await new Promise((resolve, reject) => {
			const request = db.transaction(storeName).objectStore(storeName).get(key);
			request.onsuccess = () => resolve(request.result as T | undefined);
			request.onerror = () => reject(request.error);
		});
	} finally {
		db.close();
	}
}
async function store(key: string, value: unknown): Promise<void> {
	const db = await database();
	try {
		await new Promise<void>((resolve, reject) => {
			const transaction = db.transaction(storeName, 'readwrite');
			transaction.objectStore(storeName).put(value, key);
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
		});
	} finally {
		db.close();
	}
}
async function permission(
	handle: BrowserFileHandle | BrowserDirectoryHandle,
	mode: 'read' | 'readwrite',
): Promise<boolean> {
	const options = { mode };
	if ((await handle.queryPermission?.(options)) === 'granted') return true;
	return (await handle.requestPermission?.(options)) === 'granted';
}
async function fileText(handle: BrowserFileHandle): Promise<string> {
	const file = await handle.getFile();
	if (file.size > MAX_PROJECT_BYTES)
		throw new Error('Choose a project JSON file under 8 MB.');
	return await file.text();
}
async function directoryAt(
	root: BrowserDirectoryHandle,
	parts: string[],
	create = false,
): Promise<BrowserDirectoryHandle> {
	let current = root;
	for (const part of parts)
		current = await current.getDirectoryHandle(part, { create });
	return current;
}
async function readPath(
	root: BrowserDirectoryHandle,
	path: string,
): Promise<string | null> {
	if (!safeRelativePath(path))
		throw new Error('Unsupported project-relative path');
	const parts = path.split('/');
	const name = parts.pop();
	if (!name) throw new Error('Missing filename');
	try {
		const parent = await directoryAt(root, parts);
		return await (await parent.getFileHandle(name))
			.getFile()
			.then((file) => file.text());
	} catch (error) {
		if (error instanceof DOMException && error.name === 'NotFoundError')
			return null;
		throw error;
	}
}
async function writePath(
	root: BrowserDirectoryHandle,
	path: string,
	content: string,
): Promise<void> {
	if (!safeRelativePath(path))
		throw new Error('Unsupported project-relative path');
	const parts = path.split('/');
	const name = parts.pop();
	if (!name) throw new Error('Missing filename');
	const parent = await directoryAt(root, parts, true);
	const writable = await (
		await parent.getFileHandle(name, { create: true })
	).createWritable();
	await writable.write(content);
	await writable.close();
}
async function removePath(
	root: BrowserDirectoryHandle,
	path: string,
): Promise<void> {
	const parts = path.split('/');
	const name = parts.pop();
	if (!name) return;
	const parent = await directoryAt(root, parts);
	await parent.removeEntry(name);
}
async function directoryExists(
	root: BrowserDirectoryHandle,
	path: string,
): Promise<boolean> {
	try {
		await directoryAt(root, path.split('/'));
		return true;
	} catch (error) {
		if (error instanceof DOMException && error.name === 'NotFoundError')
			return false;
		throw error;
	}
}

async function pickOpenFile(): Promise<BrowserFileHandle | undefined> {
	const select = picker().showOpenFilePicker;
	if (!select) throw new Error('This browser cannot open project files');
	try {
		return (
			await select({
				types: [
					{
						description: 'Tale project JSON',
						accept: { 'application/json': ['.json'] },
					},
				],
			})
		)[0];
	} catch (error) {
		if (cancelled(error)) return;
		throw error;
	}
}

async function pickSaveFile(
	project: Project,
): Promise<BrowserFileHandle | undefined> {
	const select = picker().showSaveFilePicker;
	if (!select) throw new Error('This browser cannot save project files');
	try {
		return await select({
			suggestedName: `${project.name.replaceAll(/[^a-zA-Z0-9_-]+/g, '-') || 'tale'}.json`,
			types: [
				{
					description: 'Tale project JSON',
					accept: { 'application/json': ['.json'] },
				},
			],
		});
	} catch (error) {
		if (cancelled(error)) return;
		throw error;
	}
}

async function pickDirectory(): Promise<BrowserDirectoryHandle | undefined> {
	const select = picker().showDirectoryPicker;
	if (!select) throw new Error('This browser cannot open project directories');
	try {
		return await select({ mode: 'readwrite' });
	} catch (error) {
		if (cancelled(error)) return;
		throw error;
	}
}
export function createChromeBridge(): Bridge {
	let currentFile: BrowserFileHandle | undefined;
	let currentProjectKey: string | undefined;
	let deploymentDirectory: BrowserDirectoryHandle | undefined;
	let pendingDirectory: BrowserDirectoryHandle | undefined;
	let plan: BrowserPlan | undefined;
	let dirty = false;
	const progress = new Set<(event: DeploymentProgress) => void>();
	const menu = new Set<(action: MenuAction) => void>();

	async function rememberProject(
		handle: BrowserFileHandle,
		existingKey?: string,
	): Promise<string> {
		const key = existingKey ?? crypto.randomUUID();
		await store(`project:${key}`, handle);
		const recent = (await stored<string[]>(recentKey)) ?? [];
		await store(
			recentKey,
			[key, ...recent.filter((entry) => entry !== key)].slice(0, maxRecent),
		);
		currentProjectKey = key;
		if (deploymentDirectory)
			await store(`deployment:${key}`, deploymentDirectory);
		return `/Chrome projects/${key}/${handle.name}`;
	}
	async function pathForCurrent(): Promise<string> {
		if (!currentFile) throw new Error('No project file selected');
		return await rememberProject(currentFile, currentProjectKey);
	}
	async function recentProjects(): Promise<string[]> {
		const recent = (await stored<string[]>(recentKey)) ?? [];
		const available: string[] = [];
		for (const key of recent) {
			const handle = await stored<BrowserFileHandle>(`project:${key}`);
			if (handle) available.push(`/Chrome projects/${key}/${handle.name}`);
		}
		return available;
	}
	async function rememberedDeployment(): Promise<
		BrowserDirectoryHandle | undefined
	> {
		if (!currentProjectKey) return;
		const remembered = await stored<BrowserDirectoryHandle>(
			`deployment:${currentProjectKey}`,
		);
		if (!remembered || !(await permission(remembered, 'readwrite'))) return;
		deploymentDirectory = remembered;
		return remembered;
	}
	async function selectedDeployment(): Promise<
		BrowserDirectoryHandle | undefined
	> {
		const selected = pendingDirectory ?? (await pickDirectory());
		pendingDirectory = undefined;
		if (!selected) return;
		if (!(await permission(selected, 'readwrite')))
			throw new Error('Write permission was not granted');
		deploymentDirectory = selected;
		if (currentProjectKey)
			await store(`deployment:${currentProjectKey}`, selected);
		return selected;
	}
	async function chooseDeployment(
		force: boolean,
	): Promise<BrowserDirectoryHandle | undefined> {
		if (!force && deploymentDirectory) return deploymentDirectory;
		if (!force) {
			const remembered = await rememberedDeployment();
			if (remembered) return remembered;
		}
		return await selectedDeployment();
	}
	async function projectHandle(path?: string): Promise<{
		handle: BrowserFileHandle;
		key?: string;
	} | null> {
		const key = path?.split('/').at(-2);
		const remembered = key
			? await stored<BrowserFileHandle>(`project:${key}`)
			: undefined;
		const handle = remembered ?? (await pickOpenFile());
		return handle ? { handle, key: remembered ? key : undefined } : null;
	}
	async function chooseProjectSaveFile(
		project: Project,
		saveAs: boolean,
	): Promise<boolean> {
		if (!saveAs && currentFile) return true;
		const selected = await pickSaveFile(project);
		if (!selected) return false;
		currentFile = selected;
		if (saveAs) {
			currentProjectKey = undefined;
			deploymentDirectory = undefined;
		}
		return true;
	}
	async function verifyDeployment(current: BrowserPlan): Promise<void> {
		for (const change of current.changes)
			if ((await readPath(current.directory, change.path)) !== change.before)
				throw new Error(`The target changed: ${change.path}. Preview again.`);
	}
	async function rollbackDeployment(
		current: BrowserPlan,
		written: DeploymentChange[],
	): Promise<void> {
		for (const change of written.reverse()) {
			if (change.before === null)
				await removePath(current.directory, change.path).catch(() => undefined);
			else await writePath(current.directory, change.path, change.before);
		}
	}
	async function applyDeployment(
		current: BrowserPlan,
		token: string,
	): Promise<void> {
		const written: DeploymentChange[] = [];
		try {
			for (const [index, change] of current.changes.entries()) {
				if (change.before !== change.after) {
					await writePath(current.directory, change.path, change.after);
					written.push(change);
				}
				for (const listener of progress)
					listener({
						token,
						completed: index + 1,
						total: current.changes.length,
						path: change.path,
					});
			}
		} catch (error) {
			await rollbackDeployment(current, written);
			throw error;
		}
	}
	async function prepare(
		project: Project,
		selections: AgentSelection[],
		chooseTarget: boolean,
		placement: ReferencePlacement,
	): Promise<Reply> {
		validateProject(project);
		validateAgentSelection(selections);
		validateReferencePlacement(placement);
		const directory = await chooseDeployment(chooseTarget);
		if (!directory) return { ok: true, cancelled: true };
		const generated = await createDeploymentChanges(
			project,
			selections,
			placement,
			{
				read: (path) => readPath(directory, path),
				resolve: (selected) =>
					resolveAgentLocation(selected, {
						read: (path) => readPath(directory, path),
						normalize: async (path) => path,
					}),
			},
		);
		const changes = generated.changes;
		const preview: DeploymentPreview = {
			token: crypto.randomUUID(),
			target: directory.name,
			taleExists: await directoryExists(directory, '.tale'),
			files: changes.map((change) => ({
				path: change.path,
				before: change.before,
				action:
					change.before === null
						? 'create'
						: change.before === change.after
							? 'unchanged'
							: 'update',
				content: change.after,
			})),
			notes: generated.notes,
		};
		plan = { preview, directory, changes };
		return { ok: true, deployment: preview };
	}

	return {
		load() {
			return Promise.resolve({
				ok: true,
				document: { project: newProject(), path: null },
			} as const);
		},
		async templates() {
			const response = await fetch('../templates/index.json');
			if (!response.ok) throw new Error('Could not load Tale templates');
			return {
				ok: true,
				templates: (await response.json()) as TemplateSummary[],
			};
		},
		async newProject(request: NewProjectRequest) {
			validateNewProject(request);
			if (!/^[a-z0-9-]+\.json$/.test(request.templateId))
				throw new Error('Unsupported Tale template');
			if (dirty && !window.confirm('Discard unsaved changes?'))
				return { ok: true, cancelled: true };
			const response = await fetch(`../templates/${request.templateId}`);
			if (!response.ok) throw new Error('Could not load the selected template');
			const project = fromTemplate(
				parseProject(await response.text()),
				request,
			);
			currentFile = undefined;
			currentProjectKey = undefined;
			deploymentDirectory = pendingDirectory;
			dirty = true;
			return { ok: true, document: { project, path: null } };
		},
		async chooseDirectory() {
			const select = picker().showDirectoryPicker;
			if (!select) throw new Error('This browser cannot open directories');
			try {
				pendingDirectory = await select({ mode: 'readwrite' });
				return { ok: true, directory: pendingDirectory.name };
			} catch (error) {
				if (cancelled(error)) return { ok: true, cancelled: true };
				throw error;
			}
		},
		async open(path?: string) {
			if (dirty && !window.confirm('Discard unsaved changes?'))
				return { ok: true, cancelled: true };
			const selected = await projectHandle(path);
			if (!selected) return { ok: true, cancelled: true };
			if (!(await permission(selected.handle, 'read')))
				throw new Error('Read permission was not granted');
			const project = parseProject(await fileText(selected.handle));
			currentFile = selected.handle;
			currentProjectKey = selected.key;
			const projectPath = await pathForCurrent();
			deploymentDirectory = undefined;
			dirty = false;
			return { ok: true, document: { project, path: projectPath } };
		},
		async recentProjects() {
			return { ok: true, recentProjects: await recentProjects() };
		},
		exit() {
			if (dirty && !window.confirm('Close Tale and discard unsaved changes?'))
				return Promise.resolve({ ok: true, cancelled: true } as const);
			window.close();
			return Promise.resolve({ ok: true } as const);
		},
		async save(project: Project, saveAs: boolean) {
			validateProject(project);
			if (!(await chooseProjectSaveFile(project, saveAs)))
				return { ok: true, cancelled: true };
			if (!currentFile) throw new Error('No project file selected');
			if (!(await permission(currentFile, 'readwrite')))
				throw new Error('Write permission was not granted');
			const writable = await currentFile.createWritable();
			await writable.write(serializeProject(project));
			await writable.close();
			const path = await pathForCurrent();
			dirty = false;
			return {
				ok: true,
				document: { project, path },
				message: 'Project saved',
			};
		},
		prepareDeployment: prepare,
		async deploy(token: string, overwrite: boolean) {
			const current = plan;
			if (!current || current.preview.token !== token)
				throw new Error('Preview deployment again');
			if (requiresTaleOverwrite(current.preview) && !overwrite)
				throw new Error('Confirm replacing the changed .tale file first');
			await verifyDeployment(current);
			await applyDeployment(current, token);
			const changed = current.preview.files.filter(
				(file) => file.action !== 'unchanged',
			).length;
			plan = undefined;
			return {
				ok: true,
				message: changed
					? `Deployed ${changed} changed file${changed === 1 ? '' : 's'}`
					: 'Already up to date',
			};
		},
		onDeploymentProgress(listener) {
			progress.add(listener);
			return () => progress.delete(listener);
		},
		async exportTales(project: Project) {
			validateProject(project);
			const select = picker().showDirectoryPicker;
			if (!select) throw new Error('This browser cannot export Tale files');
			try {
				const directory = await select({ mode: 'readwrite' });
				for (const output of compile(project))
					await writePath(directory, output.path, output.content);
				return { ok: true, message: 'Exported Tale file' };
			} catch (error) {
				if (cancelled(error)) return { ok: true, cancelled: true };
				throw error;
			}
		},
		setDirty(value: boolean) {
			dirty = value;
			return Promise.resolve({ ok: true } as const);
		},
		onMenu(listener) {
			menu.add(listener);
			return () => menu.delete(listener);
		},
	};
}
