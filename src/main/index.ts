import { app, Menu, type MenuItemConstructorOptions } from 'electron';
import type { MenuAction } from '../model/bridge.js';
import { quitWhenWindowsClose } from './lifecycle.js';
import { createWindow } from './window.js';

app.setName('Tale');
quitWhenWindowsClose();
void app
	.whenReady()
	.then(async () => {
		const win = await createWindow(app.getAppPath());
		const action = (
			label: string,
			command: MenuAction,
			accelerator?: string,
		): MenuItemConstructorOptions => ({
			label,
			accelerator,
			click: () => win.webContents.send('tale:menu', command),
		});
		const menu: MenuItemConstructorOptions[] = [
			{
				label: 'File',
				submenu: [
					action('New', 'new', 'CmdOrCtrl+N'),
					action('Open…', 'open', 'CmdOrCtrl+O'),
					action('Save', 'save', 'CmdOrCtrl+S'),
					action('Save As…', 'saveAs', 'CmdOrCtrl+Shift+S'),
					{ type: 'separator' },
					action('Deploy…', 'deploy'),
					action('Preview compiled Tales', 'compile'),
					action('Verify agreement…', 'verify'),
					{ role: 'close' },
				],
			},
			{
				label: 'Edit',
				submenu: [
					{ role: 'undo' },
					{ role: 'redo' },
					{ type: 'separator' },
					{ role: 'cut' },
					{ role: 'copy' },
					{ role: 'paste' },
					{ role: 'selectAll' },
				],
			},
		];
		if (process.platform === 'darwin')
			menu.unshift({
				label: 'Tale',
				submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }],
			});
		Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
	})
	.catch((error) => {
		console.error(error);
		app.exit(1);
	});
