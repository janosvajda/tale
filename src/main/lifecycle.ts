import { app } from 'electron';

export function quitWhenWindowsClose() {
	app.on('window-all-closed', () => app.quit());
}
