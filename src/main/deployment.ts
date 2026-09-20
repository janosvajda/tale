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
import { compile } from '../application/compiler.js';
import {
	type AgentSelection,
	agents,
	type DeploymentPreview,
	validateAgentSelection,
} from '../model/deployment.js';
import { check, type Project, record } from '../model/project.js';
import { agentReference, atomicWrite, existing } from './files.js';

interface Change {
	path: string;
	before: string | null;
	after: string;
}
export interface DeploymentPlan {
	preview: DeploymentPreview;
	changes: Change[];
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
function safePath(path: string): boolean {
	return (
		!path.includes('\\') &&
		!path.includes(':') &&
		!path.includes('\0') &&
		path.split('/').every((part) => part && part !== '.' && part !== '..')
	);
}
async function safeParents(
	root: string,
	path: string,
	created?: string[],
): Promise<void> {
	check(safePath(path), 'Unsupported instruction path');
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
async function geminiLocation(
	root: string,
	selected: AgentSelection,
	watched: Map<string, string | null>,
	notes: string[],
): Promise<string | undefined> {
	const settings = await readWatched(root, '.gemini/settings.json', watched);
	if (!settings) return;
	const value: unknown = JSON.parse(settings);
	const configured =
		record(value) && record(value.context) ? value.context.fileName : undefined;
	if (configured === undefined) return;
	const names = typeof configured === 'string' ? [configured] : configured;
	check(
		Array.isArray(names) &&
			names.length > 0 &&
			names.every((name) => typeof name === 'string' && safePath(name)),
		'Gemini context.fileName must contain project-relative filenames',
	);
	const name = selected.location === 'auto' ? names[0] : selected.location;
	check(
		names.includes(name),
		'The selected Gemini file is not enabled in .gemini/settings.json',
	);
	return casedPath(root, name, notes);
}
async function resolveLocation(
	root: string,
	selected: AgentSelection,
	watched: Map<string, string | null>,
	notes: string[],
): Promise<string> {
	const agent = agents.find((agent) => agent.id === selected.agent);
	check(agent, 'Unsupported agent');
	if (selected.agent === 'codex') {
		const override = await casedPath(root, 'AGENTS.override.md', notes);
		const content = await readWatched(root, override, watched);
		if (content?.trim()) {
			notes.push(
				`Codex loads ${override} before AGENTS.md; updating the active override.`,
			);
			return override;
		}
	}
	if (selected.agent === 'gemini') {
		const configured = await geminiLocation(root, selected, watched, notes);
		if (configured) return configured;
	}

	if (selected.location !== 'auto')
		return casedPath(root, selected.location, notes);
	const locations = agent.locations.filter((path) => path !== 'auto');
	for (const location of locations) {
		const path = await casedPath(root, location, notes);
		if ((await readWatched(root, path, watched)) !== null) return path;
	}
	const preferred = locations[0];
	check(preferred, 'Missing agent entry point');
	return preferred;
}
function activation(path: string, content: string): string {
	const field = path.endsWith('.mdc')
		? 'alwaysApply: true'
		: path.startsWith('.devin/') || path.startsWith('.windsurf/')
			? 'trigger: always_on'
			: path.endsWith('.instructions.md')
				? 'applyTo: "**"'
				: null;
	if (!field) return content;
	const newline = content.includes('\r\n') ? '\r\n' : '\n';
	if (!content.trim()) return ['---', field, '---', ''].join(newline);
	const lines = content.split(newline);
	check(
		lines[0] === '---',
		`Existing ${path} has no recognized activation header; review it before deployment.`,
	);
	const end = lines.indexOf('---', 1);
	check(end > 0, `Invalid frontmatter in ${path}`);
	const key = field.split(':')[0];
	check(
		lines.slice(1, end).some((line) => line.trim() === field),
		`Existing ${path} is not always active (${key}). Enable it in the agent or select another entry point; Tale will preserve its frontmatter.`,
	);
	return content;
}
function instructions(
	path: string,
	selected: AgentSelection[],
	outputs: string[],
	environments: Project['environments'],
): string {
	const reference = `Before planning or changing code, read ${outputs.map((output) => JSON.stringify(output)).join(', ')} from the project root and follow their agreements. If a file cannot be read, report that before implementation. Do not load a duplicate copy if it is already in context.`;
	const environmentNotes = environments.length
		? [
				'Environments (all use the same Tale file):',
				...environments.map(
					(env) =>
						`- ${JSON.stringify(env.name)}: follow the shared agreements and any instructions explicitly scoped to this environment in the Tale.`,
				),
				'If the target environment is unclear and affects the task, ask before proceeding. Do not infer environment-specific rules from its name.',
			]
		: [];
	const text = [reference, ...environmentNotes].join('\n');
	if (
		!path.endsWith('CLAUDE.md') ||
		!selected.some((agent) => agent.agent === 'claude')
	)
		return text;
	const prefix = '../'.repeat(path.split('/').length - 1);
	return [text, ...outputs.map((output) => `@${prefix}${output}`)].join('\n');
}

export async function prepareDeployment(
	target: string,
	project: Project,
	selection: AgentSelection[],
): Promise<DeploymentPlan> {
	validateAgentSelection(selection);
	const artifacts = compile(project);
	const root = await realpath(target);
	await directory(root);
	const taleExists = await directory(join(root, '.tale'));
	const notes: string[] = [];
	const watched = new Map<string, string | null>();
	const chosen = new Map<string, AgentSelection[]>();
	for (const selected of selection) {
		const path = await resolveLocation(root, selected, watched, notes);
		chosen.set(path, [...(chosen.get(path) ?? []), selected]);
	}
	const changes: Change[] = [];
	for (const artifact of artifacts) {
		check(
			!chosen.has(artifact.path),
			'A Tale output cannot also be an agent instruction file',
		);
		changes.push({
			path: artifact.path,
			before: await readWatched(root, artifact.path, watched),
			after: artifact.content,
		});
	}

	for (const [path, selected] of chosen) {
		const before = await readWatched(root, path, watched);
		const after = agentReference(
			activation(path, before ?? ''),
			instructions(
				path,
				selected,
				artifacts.map((artifact) => artifact.path),
				project.environments,
			),
		);
		changes.push({ path, before, after });
	}
	notes.push(
		'Files are installed locally. Refresh each selected agent and verify it loaded the Tale; activation settings and nested rules can affect loading.',
	);
	return {
		preview: {
			token: randomUUID(),
			target: root,
			taleExists,
			files: changes.map((change) => ({
				path: change.path,
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
): Promise<void> {
	const root = plan.preview.target;
	check(await directory(root), 'The destination no longer exists');
	const taleExists = await directory(join(root, '.tale'));
	check(
		taleExists === plan.preview.taleExists,
		'The target changed. Preview deployment again.',
	);
	check(
		!taleExists || overwrite,
		'Confirm overwriting the existing .tale deployment first',
	);
	for (const [path, before] of plan.watched) {
		await safeParents(root, path);
		check(
			(await existing(join(root, path))) === before,
			`The target changed: ${path}. Preview deployment again.`,
		);
	}
	const completed: Change[] = [];
	const created: string[] = [];
	try {
		for (const change of plan.changes) {
			if (change.before === change.after) continue;
			await safeParents(root, change.path, created);
			check(
				(await existing(join(root, change.path))) === change.before,
				`The target changed: ${change.path}`,
			);
			await write(join(root, change.path), change.after);
			completed.push(change);
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
