import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';
import { record } from '../model/project.js';
import { atomicWrite } from './files.js';

export async function lastOpenDirectory(
	file: string,
): Promise<string | undefined> {
	try {
		const value: unknown = JSON.parse(await readFile(file, 'utf8'));
		if (
			!record(value) ||
			typeof value.openDirectory !== 'string' ||
			!isAbsolute(value.openDirectory)
		)
			return;
		if ((await stat(value.openDirectory)).isDirectory())
			return value.openDirectory;
	} catch {
		// A missing folder or unreadable preference must not prevent opening a project.
	}
}
export async function rememberOpenDirectory(
	file: string,
	projectPath: string,
): Promise<void> {
	await mkdir(dirname(file), { recursive: true });
	await atomicWrite(
		file,
		`${JSON.stringify({ openDirectory: dirname(projectPath) })}\n`,
	);
}
