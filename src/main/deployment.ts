import { randomUUID } from 'node:crypto';
import {
	lstat,
	mkdir,
	readdir,
	realpath,
	rmdir,
	unlink,
} from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import {
	resolveAgentLocation,
	safeRelativePath,
} from '../application/agent-integration.js';
import {
	createDeploymentChanges,
	type DeploymentChange,
} from '../application/deployment.js';
import {
	type AgentSelection,
	type DeploymentPreview,
	type DeploymentProgress,
	type ReferencePlacement,
	requiresTaleOverwrite,
	validateAgentSelection,
} from '../model/deployment.js';
import { check, type Project } from '../model/project.js';
import { atomicWrite, existing } from './files.js';

export interface DeploymentPlan {
	preview: DeploymentPreview;
	changes: DeploymentChange[];
	watched: Map<string, string | null>;
}
async function directory(path: string): Promise<boolean> {
	try {
		const stat = await lstat(path);
		check(
			stat.isDirectory() && !stat.isSymbolicLink(),
			`Use a real directory, not a link: ${path}`,
		);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}
async function safeParents(
	root: string,
	path: string,
	created?: string[],
): Promise<void> {
	check(safeRelativePath(path), 'Unsupported instruction path');
	let current = root;
	for (const part of path.split('/').slice(0, -1)) {
		current = join(current, part);
		if (await directory(current)) continue;
		if (created) {
			await mkdir(current);
			created.push(current);
		}
	}
}
async function casedPath(
	root: string,
	path: string,
	notes: string[],
): Promise<string> {
	await safeParents(root, path);
	const parent = dirname(join(root, path));
	if (!(await directory(parent))) return path;
	const name = path.split('/').at(-1) ?? '';
	const matches = (await readdir(parent)).filter(
		(entry) => entry.toLowerCase() === name.toLowerCase(),
	);
	check(
		matches.length <= 1,
		`Multiple instruction files differ only in case: ${path}`,
	);
	const match = matches[0];
	if (!match) return path;
	const actual = relative(root, join(parent, match)).split(sep).join('/');
	if (actual !== path)
		notes.push(
			`Preserving ${actual}. This agent documents ${path}; on case-sensitive systems, configure the matching filename or rename it before starting the agent.`,
		);
	return actual;
}
async function readWatched(
	root: string,
	path: string,
	watched: Map<string, string | null>,
): Promise<string | null> {
	await safeParents(root, path);
	const value = await existing(join(root, path));
	watched.set(path, value);
	return value;
}
export async function prepareDeployment(
	target: string,
	project: Project,
	selection: AgentSelection[],
	placement: ReferencePlacement = 'end',
): Promise<DeploymentPlan> {
	validateAgentSelection(selection);
	const root = await realpath(target);
	await directory(root);
	const taleExists = await directory(join(root, '.tale'));
	const notes: string[] = [];
	const watched = new Map<string, string | null>();
	const generated = await createDeploymentChanges(
		project,
		selection,
		placement,
		{
			read: (path) => readWatched(root, path, watched),
			resolve: (selected) =>
				resolveAgentLocation(selected, {
					read: (path) => readWatched(root, path, watched),
					normalize: (path) => casedPath(root, path, notes),
					note: (message) => notes.push(message),
				}),
		},
	);
	const changes = generated.changes;
	notes.push(...generated.notes);
	return {
		preview: {
			token: randomUUID(),
			target: root,
			taleExists,
			files: changes.map((change) => ({
				path: change.path,
				before: change.before,
				action:
					change.before === null
						? 'create'
						: change.before === change.after
							? 'unchanged'
							: 'update',
				content: change.after,
			})),
			notes: [...new Set(notes)],
		},
		changes,
		watched,
	};
}
export async function commitDeployment(
	plan: DeploymentPlan,
	overwrite: boolean,
	write = atomicWrite,
	onProgress?: (progress: Omit<DeploymentProgress, 'token'>) => void,
): Promise<void> {
	const root = plan.preview.target;
	check(await directory(root), 'The destination no longer exists');
	const taleExists = await directory(join(root, '.tale'));
	check(
		taleExists === plan.preview.taleExists,
		'The target changed. Preview deployment again.',
	);
	check(
		!requiresTaleOverwrite(plan.preview) || overwrite,
		'Confirm replacing the changed .tale file first',
	);
	for (const [path, before] of plan.watched) {
		await safeParents(root, path);
		check(
			(await existing(join(root, path))) === before,
			`The target changed: ${path}. Preview deployment again.`,
		);
	}
	const completed: DeploymentChange[] = [];
	const created: string[] = [];
	try {
		for (const [index, change] of plan.changes.entries()) {
			if (change.before === change.after) {
				onProgress?.({
					completed: index + 1,
					total: plan.changes.length,
					path: change.path,
				});
				continue;
			}
			await safeParents(root, change.path, created);
			check(
				(await existing(join(root, change.path))) === change.before,
				`The target changed: ${change.path}`,
			);
			await write(join(root, change.path), change.after);
			completed.push(change);
			onProgress?.({
				completed: index + 1,
				total: plan.changes.length,
				path: change.path,
			});
		}
	} catch (error) {
		for (const change of completed.reverse()) {
			if (change.before === null) await unlink(join(root, change.path));
			else await atomicWrite(join(root, change.path), change.before);
		}
		for (const path of created.reverse()) await rmdir(path);
		throw error;
	}
}
