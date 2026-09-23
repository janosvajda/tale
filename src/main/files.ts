import { randomUUID } from 'node:crypto';
import {
	lstat,
	mkdir,
	readFile,
	realpath,
	rename,
	unlink,
	writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { compile } from '../application/compiler.js';

export {
	agentReference,
	hasUnmanagedTaleInstruction,
	withoutManagedReference,
} from '../application/agent-reference.js';

import {
	MAX_PROJECT_BYTES,
	type Project,
	parseProject,
} from '../model/project.js';

export async function readProject(path: string): Promise<Project> {
	const stat = await lstat(path);
	if (!stat.isFile() || stat.size > MAX_PROJECT_BYTES)
		throw new Error('Choose a project JSON file under 8 MB.');
	return parseProject(await readFile(path, 'utf8'));
}
export async function existing(path: string): Promise<string | null> {
	try {
		const stat = await lstat(path);
		if (!stat.isFile() || stat.isSymbolicLink())
			throw new Error(`Refusing to replace a non-regular file: ${path}`);
		return await readFile(path, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}
export async function atomicWrite(
	path: string,
	content: string,
): Promise<void> {
	await existing(path);
	const temporary = join(dirname(path), `.tale-write-${randomUUID()}.tmp`);
	try {
		await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx' });
		await rename(temporary, path);
	} finally {
		await unlink(temporary).catch(() => undefined);
	}
}
export async function exportTales(
	target: string,
	project: Project,
): Promise<number> {
	const artifacts = compile(project);
	if (!artifacts.length) throw new Error('No Tale outputs configured');
	const root = await realpath(target);
	for (const artifact of artifacts) {
		const parts = artifact.path.split('/');
		let directory = root;
		for (const part of parts.slice(0, -1)) {
			directory = join(directory, part);
			try {
				const stat = await lstat(directory);
				if (!stat.isDirectory() || stat.isSymbolicLink())
					throw new Error('Export directory must not be a link');
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
				await mkdir(directory);
			}
		}
		await atomicWrite(join(root, artifact.path), artifact.content);
	}
	return artifacts.length;
}
