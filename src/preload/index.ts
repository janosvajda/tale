import { contextBridge, ipcRenderer } from 'electron';
import type { Bridge, MenuAction, Reply } from '../model/bridge.js';

// Sandboxed preload stays self-contained: only type imports outside Electron.
const bridge: Bridge = {
	newProject: (request) =>
		ipcRenderer.invoke('tale:new', request) as Promise<Reply>,
	templates: () => ipcRenderer.invoke('tale:templates') as Promise<Reply>,
	chooseDirectory: (initialPath) =>
		ipcRenderer.invoke('tale:choose-directory', initialPath) as Promise<Reply>,
	exportTales: (project) =>
		ipcRenderer.invoke('tale:export', project) as Promise<Reply>,
	load: () => ipcRenderer.invoke('tale:load') as Promise<Reply>,
	exit: () => ipcRenderer.invoke('tale:exit') as Promise<Reply>,
	open: (path) => ipcRenderer.invoke('tale:open', path) as Promise<Reply>,
	recentProjects: () =>
		ipcRenderer.invoke('tale:recent-projects') as Promise<Reply>,
	save: (project, saveAs) =>
		ipcRenderer.invoke('tale:save', { project, saveAs }) as Promise<Reply>,
	prepareDeployment: (project, agents, chooseTarget, placement) =>
		ipcRenderer.invoke('tale:prepare-deployment', {
			project,
			agents,
			chooseTarget,
			placement,
		}) as Promise<Reply>,
	deploy: (token, overwrite) =>
		ipcRenderer.invoke('tale:deploy', { token, overwrite }) as Promise<Reply>,
	onDeploymentProgress(callback) {
		const listener = (_event: Electron.IpcRendererEvent, value: unknown) => {
			if (
				value !== null &&
				typeof value === 'object' &&
				'token' in value &&
				typeof value.token === 'string' &&
				'completed' in value &&
				typeof value.completed === 'number' &&
				Number.isSafeInteger(value.completed) &&
				'total' in value &&
				typeof value.total === 'number' &&
				Number.isSafeInteger(value.total) &&
				'path' in value &&
				typeof value.path === 'string' &&
				value.completed >= 0 &&
				value.completed <= value.total
			)
				callback(value as Parameters<typeof callback>[0]);
		};
		ipcRenderer.on('tale:deployment-progress', listener);
		return () =>
			ipcRenderer.removeListener('tale:deployment-progress', listener);
	},
	setDirty: (dirty) =>
		ipcRenderer.invoke('tale:dirty', dirty) as Promise<Reply>,
	onMenu(callback) {
		const listener = (_event: Electron.IpcRendererEvent, action: unknown) => {
			if (
				typeof action === 'string' &&
				['new', 'open', 'save', 'saveAs', 'deploy', 'compile', 'exit'].includes(
					action,
				)
			)
				callback(action as MenuAction);
		};
		ipcRenderer.on('tale:menu', listener);
		return () => ipcRenderer.removeListener('tale:menu', listener);
	},
};
contextBridge.exposeInMainWorld('tale', Object.freeze(bridge));
