import { mkdir, readFile, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { record } from '../model/project.js';
import { atomicWrite } from './files.js';

const recentLimit = 10;
interface FilePreferences {
	openDirectory?: string;
	recentProjects?: string[];
	deploymentDirectories?: Record<string, string>;
}
async function readPreferences(file: string): Promise<FilePreferences> {
	try {
		const value: unknown = JSON.parse(await readFile(file, 'utf8'));
		if (!record(value)) return {};
		return {
			openDirectory:
				typeof value.openDirectory === 'string'
					? value.openDirectory
					: undefined,
			recentProjects: Array.isArray(value.recentProjects)
				? value.recentProjects.filter(
						(path): path is string =>
							typeof path === 'string' && isAbsolute(path),
					)
				: [],
			deploymentDirectories: record(value.deploymentDirectories)
				? Object.fromEntries(
						Object.entries(value.deploymentDirectories).filter(
							(entry): entry is [string, string] =>
								isAbsolute(entry[0]) &&
								typeof entry[1] === 'string' &&
								isAbsolute(entry[1]),
						),
					)
				: {},
		};
	} catch {
		return {};
	}
}
function unique(paths: string[]): string[] {
	const seen = new Set<string>();
	return paths
		.filter((path) => {
			const key = process.platform === 'win32' ? path.toLowerCase() : path;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.slice(0, recentLimit);
}
async function writePreferences(
	file: string,
	value: FilePreferences,
): Promise<void> {
	await mkdir(dirname(file), { recursive: true });
	await atomicWrite(file, `${JSON.stringify(value)}\n`);
}
export async function lastOpenDirectory(
	file: string,
): Promise<string | undefined> {
	try {
		const value = await readPreferences(file);
		if (!value.openDirectory || !isAbsolute(value.openDirectory)) return;
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
	const preferences = await readPreferences(file);
	await writePreferences(file, {
		...preferences,
		openDirectory: dirname(resolve(projectPath)),
	});
}
export async function recentProjects(file: string): Promise<string[]> {
	const preferences = await readPreferences(file);
	const candidates = unique(preferences.recentProjects ?? []);
	const available: string[] = [];
	for (const path of candidates)
		try {
			if ((await stat(path)).isFile()) available.push(path);
		} catch {
			// Missing recent files do not block the menu.
		}
	return available;
}
export async function rememberRecentProject(
	file: string,
	projectPath: string,
): Promise<void> {
	const preferences = await readPreferences(file);
	const path = await realpath(projectPath);
	await writePreferences(file, {
		...preferences,
		openDirectory: dirname(path),
		recentProjects: unique([path, ...(preferences.recentProjects ?? [])]),
	});
}
export async function lastDeploymentDirectory(
	file: string,
	projectPath: string,
): Promise<string | undefined> {
	try {
		const path = await realpath(projectPath);
		const target = (await readPreferences(file)).deploymentDirectories?.[path];
		if (target && (await stat(target)).isDirectory()) return target;
	} catch {
		// A missing project or destination requires choosing a new folder.
	}
}
export async function rememberDeploymentDirectory(
	file: string,
	projectPath: string,
	target: string,
): Promise<void> {
	const path = await realpath(projectPath);
	const directory = await realpath(target);
	if (!(await stat(directory)).isDirectory())
		throw new Error('Deployment destination is not a directory');
	const preferences = await readPreferences(file);
	await writePreferences(file, {
		...preferences,
		deploymentDirectories: {
			...preferences.deploymentDirectories,
			[path]: directory,
		},
	});
}
