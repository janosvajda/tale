import { type AgentSelection, agents } from '../model/deployment.js';
import { check, type Project, record } from '../model/project.js';

export function safeRelativePath(path: string): boolean {
	return (
		!path.includes('\\') &&
		!path.includes(':') &&
		!path.includes('\0') &&
		path.split('/').every((part) => part && part !== '.' && part !== '..')
	);
}

interface AgentFiles {
	read(path: string): Promise<string | null>;
	normalize(path: string): Promise<string>;
	note?(message: string): void;
}

async function configuredGeminiLocation(
	selected: AgentSelection,
	files: AgentFiles,
): Promise<string | undefined> {
	const settingsPath = await files.normalize('.gemini/settings.json');
	const settings = await files.read(settingsPath);
	if (!settings) return;
	const value: unknown = JSON.parse(settings);
	const configured =
		record(value) && record(value.context) ? value.context.fileName : undefined;
	if (configured === undefined) return;
	const names = typeof configured === 'string' ? [configured] : configured;
	check(
		Array.isArray(names) &&
			names.length > 0 &&
			names.every((name) => typeof name === 'string' && safeRelativePath(name)),
		'Gemini context.fileName must contain project-relative filenames',
	);
	const name = selected.location === 'auto' ? names[0] : selected.location;
	check(
		name && names.includes(name),
		'The selected Gemini file is not enabled in .gemini/settings.json',
	);
	return await files.normalize(name);
}

export async function resolveAgentLocation(
	selected: AgentSelection,
	files: AgentFiles,
): Promise<string> {
	const agent = agents.find((entry) => entry.id === selected.agent);
	check(agent, 'Unsupported agent');
	if (selected.agent === 'codex') {
		const override = await files.normalize('AGENTS.override.md');
		if ((await files.read(override))?.trim()) {
			files.note?.(
				`Codex loads ${override} before AGENTS.md; updating the active override.`,
			);
			return override;
		}
	}
	if (selected.agent === 'gemini') {
		const configured = await configuredGeminiLocation(selected, files);
		if (configured) return configured;
	}
	if (selected.location !== 'auto')
		return await files.normalize(selected.location);
	const locations = agent.locations.filter((path) => path !== 'auto');
	for (const location of locations) {
		const path = await files.normalize(location);
		if ((await files.read(path)) !== null) return path;
	}
	const preferred = locations[0];
	check(preferred, 'Missing agent entry point');
	return await files.normalize(preferred);
}

export function activateAgentFile(path: string, content: string): string {
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

export function agentInstructions(
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
					(environment) =>
						`- ${JSON.stringify(environment.name)}: follow the shared agreements and any instructions explicitly scoped to this environment in the Tale.`,
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
