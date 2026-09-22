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
import type { ReferencePlacement } from '../model/deployment.js';
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
function bounds(content: string): { first: number; last: number } | null {
	const first = content.indexOf(start);
	const last = content.indexOf(end);
	if (first < 0 && last < 0) return null;
	if (
		first < 0 ||
		last < first ||
		content.indexOf(start, first + start.length) >= 0 ||
		content.indexOf(end, last + end.length) >= 0
	)
		throw new Error(
			'The existing Tale reference is ambiguous. Resolve its markers before deploying.',
		);
	return { first, last };
}
export function hasUnmanagedTaleInstruction(
	content: string,
	paths: string[],
): boolean {
	const found = bounds(content);
	const unmanaged = found
		? content.slice(0, found.first) + content.slice(found.last + end.length)
		: content;
	let inCode = false;
	for (const line of unmanaged.replaceAll('\r\n', '\n').split('\n')) {
		const trimmed = line.trim();
		if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
			inCode = !inCode;
			continue;
		}
		if (
			!inCode &&
			trimmed.toLowerCase().includes('read') &&
			paths.some((path) => trimmed.includes(path))
		)
			return true;
	}
	return false;
}
export function withoutManagedReference(content: string): string {
	const found = bounds(content);
	if (!found) return content;
	const before = content.slice(0, found.first);
	const after = content.slice(found.last + end.length);
	const newline = content.includes('\r\n') ? '\r\n' : '\n';
	if (!after.trim() && before.endsWith(newline + newline))
		return before.slice(0, -newline.length);
	return before + after;
}
function atBeginning(content: string, block: string, newline: string): string {
	const opening = `---${newline}`;
	const closing = `${newline}---${newline}`;
	const header = content.startsWith(opening)
		? content.indexOf(closing, opening.length)
		: -1;
	const insertAt = header < 0 ? 0 : header + closing.length;
	const prefix = content.slice(0, insertAt);
	const rest = content.slice(insertAt);
	return `${prefix}${block}${newline}${rest ? newline + rest : ''}`;
}
export function agentReference(
	content: string,
	instructions?: string,
	placement: ReferencePlacement = 'end',
): string {
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
	const found = bounds(content);
	if (!found && placement === 'beginning')
		return atBeginning(content, block, newline);
	if (!found)
		return `${content}${content.length ? (content.endsWith('\n') ? newline : newline + newline) : ''}${block}${newline}`;
	return (
		content.slice(0, found.first) +
		block +
		content.slice(found.last + end.length)
	);
}
