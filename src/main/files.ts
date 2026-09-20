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

const start = '<!-- tale:project:start -->';
const end = '<!-- tale:project:end -->';
export function agentReference(content: string, instructions?: string): string {
	const newline = content.includes('\r\n') ? '\r\n' : '\n';
	const block = [
		start,
		(
			instructions ??
			'Before working in this project, read .tale/project.tale and follow its agreements. If it cannot be read, report that before implementation.'
		)
			.replaceAll('\r\n', '\n')
			.split('\n')
			.join(newline),
		end,
	].join(newline);
	const a = content.indexOf(start);
	const b = content.indexOf(end);
	if (a < 0 && b < 0)
		return `${content}${content.length ? (content.endsWith('\n') ? newline : newline + newline) : ''}${block}${newline}`;
	if (
		a < 0 ||
		b < a ||
		content.indexOf(start, a + start.length) >= 0 ||
		content.indexOf(end, b + end.length) >= 0
	)
		throw new Error(
			'The existing Tale reference is ambiguous. Resolve its markers before deploying.',
		);
	return content.slice(0, a) + block + content.slice(b + end.length);
}
