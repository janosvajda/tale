import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
	app,
	BrowserWindow,
	dialog,
	type IpcMainInvokeEvent,
	ipcMain,
} from 'electron';
import type { Reply } from '../model/bridge.js';
import {
	validateAgentSelection,
	validateReferencePlacement,
} from '../model/deployment.js';
import { newProject, validateNewProject } from '../model/new-project.js';
import {
	check,
	record,
	serializeProject,
	validateDirectory,
	validateProject,
} from '../model/project.js';
import { windowIcon } from './app-icons.js';
import {
	commitDeployment,
	type DeploymentPlan,
	prepareDeployment,
} from './deployment.js';
import { atomicWrite, exportTales, readProject } from './files.js';
import {
	lastDeploymentDirectory,
	lastOpenDirectory,
	recentProjects,
	rememberDeploymentDirectory,
	rememberRecentProject,
} from './preferences.js';
import { createFromTemplate, listTemplates } from './templates.js';
export interface FileDialogs {
	open(defaultPath?: string): Promise<string | undefined>;
	save(): Promise<string | undefined>;
	target(defaultPath?: string): Promise<string | undefined>;
	discard(): Promise<boolean>;
}
async function existingDirectory(path: string | undefined) {
	if (!path) return;
	try {
		if ((await stat(path)).isDirectory()) return path;
	} catch {
		// A removed destination must be selected again.
	}
}
export function trustedSender(
	actual: { url: string; mainFrame: boolean; webContentsId: number },
	expected: { url: string; webContentsId: number },
): boolean {
	return (
		actual.mainFrame &&
		actual.url === expected.url &&
		actual.webContentsId === expected.webContentsId
	);
}
export async function createWindow(
	root: string,
	options: {
		hidden?: boolean;
		dialogs?: FileDialogs;
		preferencesPath?: string;
	} = {},
): Promise<BrowserWindow> {
	const url = pathToFileURL(join(root, 'dist/browser/ui/index.html')).href;
	const win = new BrowserWindow({
		icon: windowIcon(root),
		width: 1440,
		height: 940,
		minWidth: 900,
		minHeight: 640,
		show: false,
		title: 'Tale',
		backgroundColor: '#f5f6f8',
		webPreferences: {
			preload: join(root, 'dist/node/src/preload/index.js'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			webSecurity: true,
		},
	});
	const preferences =
		options.preferencesPath ??
		join(app.getPath('userData'), 'file-dialogs.json');
	const dialogs: FileDialogs = options.dialogs ?? {
		async open(defaultPath) {
			const r = await dialog.showOpenDialog(win, {
				properties: ['openFile'],
				defaultPath,
				filters: [{ name: 'Tale project', extensions: ['json'] }],
			});
			return r.canceled ? undefined : r.filePaths[0];
		},
		async save() {
			const r = await dialog.showSaveDialog(win, {
				defaultPath: 'tale.project.json',
				filters: [{ name: 'Tale project', extensions: ['json'] }],
			});
			return r.canceled ? undefined : r.filePath;
		},
		async target(defaultPath) {
			const r = await dialog.showOpenDialog(win, {
				title: 'Choose project directory',
				defaultPath,
				properties: ['openDirectory', 'createDirectory'],
			});
			return r.canceled ? undefined : r.filePaths[0];
		},
		async discard() {
			const r = await dialog.showMessageBox(win, {
				type: 'question',
				message: 'Discard unsaved changes?',
				detail: 'Choose Cancel to return and save your project.',
				buttons: ['Cancel', 'Discard'],
				defaultId: 0,
				cancelId: 0,
			});
			return r.response === 1;
		},
	};
	let deploymentTarget: string | undefined;
	let lastDeployedTarget: string | undefined;
	let deployment: DeploymentPlan | undefined;
	let path: string | null = null;
	let dirty = false;
	let closing = false;
	let busy = false;
	const channels: string[] = [];
	function handler(
		channel: string,
		action: (payload: unknown) => Promise<Reply> | Reply,
	) {
		channels.push(channel);
		ipcMain.handle(
			channel,
			async (event: IpcMainInvokeEvent, payload: unknown): Promise<Reply> => {
				try {
					check(
						trustedSender(
							{
								url: event.senderFrame?.url ?? '',
								mainFrame: event.senderFrame === win.webContents.mainFrame,
								webContentsId: event.sender.id,
							},
							{ url, webContentsId: win.webContents.id },
						),
						'Unauthorized application request',
					);
					if (channel === 'tale:dirty') return await action(payload);
					check(!busy, 'Another file operation is still running');
					busy = true;
					try {
						return await action(payload);
					} finally {
						busy = false;
					}
				} catch (error) {
					return {
						ok: false,
						error: error instanceof Error ? error.message : 'Operation failed',
					};
				}
			},
		);
	}
	handler('tale:exit', async (payload) => {
		check(payload === undefined, 'Unexpected exit payload');
		if (dirty && !(await dialogs.discard()))
			return { ok: true, cancelled: true };
		closing = true;
		setImmediate(() => win.close());
		return { ok: true };
	});
	handler('tale:templates', async (payload) => {
		check(payload === undefined, 'Unexpected templates payload');
		return {
			ok: true,
			templates: await listTemplates(join(root, 'templates')),
		};
	});
	handler('tale:choose-directory', async (payload) => {
		if (payload !== undefined) validateDirectory(payload);
		const directory = await dialogs.target(payload);
		return directory ? { ok: true, directory } : { ok: true, cancelled: true };
	});
	handler('tale:new', async (payload) => {
		validateNewProject(payload);
		const project = await createFromTemplate(join(root, 'templates'), payload);
		if (dirty && !(await dialogs.discard()))
			return { ok: true, cancelled: true };
		path = null;
		dirty = true;
		deploymentTarget = undefined;
		lastDeployedTarget = undefined;
		deployment = undefined;
		return { ok: true, document: { project, path: null } };
	});
	handler('tale:export', async (payload) => {
		validateProject(payload);
		const target = await dialogs.target();
		if (!target) return { ok: true, cancelled: true };
		const count = await exportTales(target, payload);
		return {
			ok: true,
			message: `Exported ${count} Tale file${count === 1 ? '' : 's'}`,
		};
	});
	handler('tale:load', (payload) => {
		check(payload === undefined, 'Unexpected load payload');
		path = null;
		dirty = false;
		return {
			ok: true,
			document: {
				project: newProject(),
				path: null,
			},
		};
	});
	handler('tale:recent-projects', async (payload) => {
		check(payload === undefined, 'Unexpected recent-project request');
		return { ok: true, recentProjects: await recentProjects(preferences) };
	});
	handler('tale:open', async (payload) => {
		check(
			payload === undefined || typeof payload === 'string',
			'Invalid open request',
		);
		if (typeof payload === 'string')
			check(
				(await recentProjects(preferences)).includes(payload),
				'Recent project is no longer available',
			);
		if (dirty && !(await dialogs.discard()))
			return { ok: true, cancelled: true };
		const selected =
			payload ?? (await dialogs.open(await lastOpenDirectory(preferences)));
		if (!selected) return { ok: true, cancelled: true };
		const project = await readProject(selected);
		path = resolve(selected);
		dirty = false;
		deploymentTarget = undefined;
		lastDeployedTarget = undefined;
		deployment = undefined;
		let message: string | undefined;
		try {
			await rememberRecentProject(preferences, path);
		} catch {
			message = 'Project opened, but it could not be added to recent projects.';
		}
		return { ok: true, document: { project, path }, message };
	});
	handler('tale:save', async (payload) => {
		check(
			record(payload) &&
				Object.keys(payload).every((k) => ['project', 'saveAs'].includes(k)) &&
				typeof payload.saveAs === 'boolean',
			'Invalid save request',
		);
		validateProject(payload.project);
		const selected = payload.saveAs || !path ? await dialogs.save() : path;
		if (!selected) return { ok: true, cancelled: true };
		const previousTarget =
			lastDeployedTarget ??
			(path ? await lastDeploymentDirectory(preferences, path) : undefined);
		await atomicWrite(selected, serializeProject(payload.project));
		path = resolve(selected);
		dirty = false;
		let message = 'Project saved';
		try {
			await rememberRecentProject(preferences, path);
			if (previousTarget)
				await rememberDeploymentDirectory(preferences, path, previousTarget);
		} catch {
			message =
				'Project saved, but some local preferences could not be updated.';
		}
		return {
			ok: true,
			document: { project: payload.project, path },
			message,
		};
	});
	handler('tale:prepare-deployment', async (payload) => {
		deployment = undefined;
		check(
			record(payload) && typeof payload.chooseTarget === 'boolean',
			'Invalid deployment request',
		);
		validateProject(payload.project);
		validateAgentSelection(payload.agents);
		validateReferencePlacement(payload.placement);
		const remembered = path
			? await lastDeploymentDirectory(preferences, path)
			: undefined;
		deploymentTarget = await existingDirectory(deploymentTarget);
		if (!payload.chooseTarget && !deploymentTarget && !remembered)
			return { ok: true, cancelled: true };
		let target = deploymentTarget ?? remembered;
		if (payload.chooseTarget) {
			const selected = await dialogs.target(
				target ?? payload.project.deploymentDirectory,
			);
			if (!selected) return { ok: true, cancelled: true };
			target = selected;
		}
		check(target, 'Choose the destination project');
		deployment = await prepareDeployment(
			target,
			payload.project,
			payload.agents,
			payload.placement,
		);
		deploymentTarget = deployment.preview.target;
		return { ok: true, deployment: deployment.preview };
	});
	handler('tale:deploy', async (payload) => {
		check(
			record(payload) &&
				typeof payload.token === 'string' &&
				typeof payload.overwrite === 'boolean',
			'Invalid deployment confirmation',
		);
		check(
			deployment && deployment.preview.token === payload.token,
			'Preview deployment before confirming',
		);
		const plan = deployment;
		deployment = undefined;
		const noChanges = plan.preview.files.every(
			(file) => file.action === 'unchanged',
		);
		await commitDeployment(plan, payload.overwrite, undefined, (progress) => {
			win.webContents.send('tale:deployment-progress', {
				...progress,
				token: plan.preview.token,
			});
		});
		deploymentTarget = plan.preview.target;
		lastDeployedTarget = plan.preview.target;
		let preferenceWarning = '';
		if (path)
			try {
				await rememberDeploymentDirectory(
					preferences,
					path,
					plan.preview.target,
				);
			} catch {
				preferenceWarning = ' The destination could not be remembered.';
			}
		return {
			ok: true,
			message: `${
				noChanges
					? 'Already up to date. No files changed.'
					: `Deployed Tale files and agent instructions to ${plan.preview.target}`
			}${preferenceWarning}`,
		};
	});
	handler('tale:dirty', (payload) => {
		check(typeof payload === 'boolean', 'Invalid dirty state');
		dirty = payload;
		return { ok: true };
	});
	win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
	win.webContents.on('will-navigate', (event) => event.preventDefault());
	win.webContents.session.setPermissionRequestHandler(
		(_wc, _permission, callback) => callback(false),
	);
	win.on('close', (event) => {
		if (closing) return;
		if (busy) {
			event.preventDefault();
			return;
		}
		if (!dirty) return;
		event.preventDefault();
		busy = true;
		void dialogs.discard().then((discard) => {
			busy = false;
			if (discard) {
				closing = true;
				win.close();
			}
		});
	});
	win.on('closed', () => {
		for (const channel of channels) ipcMain.removeHandler(channel);
	});
	await win.loadURL(url);
	if (!options.hidden) win.show();
	return win;
}
