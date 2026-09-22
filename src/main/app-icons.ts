import { join } from 'node:path';

const iconDirectory = 'tale_electron_icons';

function resource(root: string, file: string): string {
	return join(root, 'dist', 'resources', iconDirectory, file);
}

export function windowIcon(root: string, platform = process.platform): string {
	return resource(root, platform === 'win32' ? 'tale.ico' : 'tale-256.png');
}

export function dockIcon(root: string): string {
	return resource(root, 'tale-512.png');
}
