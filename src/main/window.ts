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
import { validateAgentSelection } from '../model/deployment.js';
import {
	check,
	record,
	serializeProject,
	validateProject,
} from '../model/project.js';
import {
	commitDeployment,
	type DeploymentPlan,
	prepareDeployment,
} from './deployment.js';
import { atomicWrite, exportTales, readProject } from './files.js';
import { VerificationSession } from './verification.js';

const maxApprovalReasonLength = 2000;
export interface FileDialogs {
	open(): Promise<string | undefined>;
	save(): Promise<string | undefined>;
	target(): Promise<string | undefined>;
	discard(): Promise<boolean>;
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
		approvalStore?: string;
		confirmApproval?: (details: string) => Promise<boolean>;
	} = {},
): Promise<BrowserWindow> {
	const url = pathToFileURL(join(root, 'dist/browser/ui/index.html')).href;
	const win = new BrowserWindow({
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
	const dialogs: FileDialogs = options.dialogs ?? {
		async open() {
			const r = await dialog.showOpenDialog(win, {
				properties: ['openFile'],
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
		async target() {
			const r = await dialog.showOpenDialog(win, {
				title: 'Deploy to project',
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
	const verification = new VerificationSession(
		options.approvalStore ?? join(app.getPath('userData'), 'approvals'),
	);
	let deploymentTarget: string | undefined;
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
	handler('tale:new', (payload) => {
		check(payload === undefined, 'Unexpected new-project payload');
		path = null;
		dirty = false;
		return { ok: true };
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
	handler('tale:load', async (payload) => {
		check(payload === undefined, 'Unexpected load payload');
		return {
			ok: true,
			document: {
				project: await readProject(join(root, 'tale.project.json')),
				path: null,
			},
		};
	});
	handler('tale:open', async (payload) => {
		check(payload === undefined, 'Unexpected open payload');
		if (dirty && !(await dialogs.discard()))
			return { ok: true, cancelled: true };
		const selected = await dialogs.open();
		if (!selected) return { ok: true, cancelled: true };
		const project = await readProject(selected);
		path = resolve(selected);
		dirty = false;
		return { ok: true, document: { project, path } };
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
		await atomicWrite(selected, serializeProject(payload.project));
		path = resolve(selected);
		dirty = false;
		return {
			ok: true,
			document: { project: payload.project, path },
			message: 'Project saved',
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
		if (payload.chooseTarget || !deploymentTarget) {
			const selected = await dialogs.target();
			if (!selected) return { ok: true, cancelled: true };
			deploymentTarget = selected;
		}
		deployment = await prepareDeployment(
			deploymentTarget,
			payload.project,
			payload.agents,
		);
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
		await commitDeployment(plan, payload.overwrite);
		return {
			ok: true,
			message: `Deployed Tale files and agent instructions to ${plan.preview.target}`,
		};
	});
	handler('tale:prepare-verification', async (payload) => {
		validateProject(payload);
		const target = await dialogs.target();
		if (!target) return { ok: true, cancelled: true };
		return {
			ok: true,
			verification: await verification.prepare(payload, target),
		};
	});
	handler('tale:approve-verification', async (payload) => {
		check(
			record(payload) &&
				typeof payload.token === 'string' &&
				typeof payload.reason === 'string' &&
				payload.reason.length <= maxApprovalReasonLength,
			'Invalid approval request',
		);
		const preview = await verification.approve(
			payload.token,
			payload.reason,
			options.confirmApproval ??
				(async (detail) => {
					const answer = await dialog.showMessageBox(win, {
						type: 'question',
						message: 'Approve this contract and its executable checks?',
						detail,
						buttons: ['Cancel', 'Approve'],
						defaultId: 0,
						cancelId: 0,
					});
					return answer.response === 1;
				}),
		);
		return preview
			? { ok: true, verification: preview }
			: { ok: true, cancelled: true };
	});
	handler('tale:run-verification', async (payload) => {
		check(typeof payload === 'string', 'Invalid verification token');
		return { ok: true, evidence: await verification.run(payload) };
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
