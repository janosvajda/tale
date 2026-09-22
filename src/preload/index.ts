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
	open: () => ipcRenderer.invoke('tale:open') as Promise<Reply>,
	save: (project, saveAs) =>
		ipcRenderer.invoke('tale:save', { project, saveAs }) as Promise<Reply>,
	prepareDeployment: (project, agents, chooseTarget) =>
		ipcRenderer.invoke('tale:prepare-deployment', {
			project,
			agents,
			chooseTarget,
		}) as Promise<Reply>,
	deploy: (token, overwrite) =>
		ipcRenderer.invoke('tale:deploy', { token, overwrite }) as Promise<Reply>,
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
