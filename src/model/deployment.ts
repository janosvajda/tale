import { check, record } from './project.js';

export const agents = [
	{
		id: 'codex',
		label: 'Codex',
		locations: ['auto', 'AGENTS.md', 'AGENTS.override.md'],
	},
	{
		id: 'claude',
		label: 'Claude Code',
		locations: [
			'auto',
			'CLAUDE.md',
			'.claude/CLAUDE.md',
			'.claude/rules/tale.md',
		],
	},
	{ id: 'gemini', label: 'Gemini CLI', locations: ['auto', 'GEMINI.md'] },
	{
		id: 'cursor',
		label: 'Cursor',
		locations: ['auto', '.cursor/rules/tale.mdc', 'AGENTS.md'],
	},
	{
		id: 'copilot',
		label: 'GitHub Copilot',
		locations: [
			'auto',
			'.github/copilot-instructions.md',
			'.github/instructions/tale.instructions.md',
		],
	},
	{
		id: 'windsurf',
		label: 'Windsurf / Cascade',
		locations: [
			'auto',
			'.devin/rules/tale.md',
			'.windsurf/rules/tale.md',
			'AGENTS.md',
		],
	},
	{
		id: 'cline',
		label: 'Cline',
		locations: [
			'auto',
			'.clinerules/tale.md',
			'.cline/rules/tale.md',
			'AGENTS.md',
		],
	},
] as const;
export type AgentId = (typeof agents)[number]['id'];
export interface AgentSelection {
	agent: AgentId;
	location: string;
}
export type ReferencePlacement = 'beginning' | 'end';
export interface DeploymentProgress {
	token: string;
	completed: number;
	total: number;
	path: string;
}
export function validateReferencePlacement(
	value: unknown,
): asserts value is ReferencePlacement {
	check(
		value === 'beginning' || value === 'end',
		'Invalid Tale reference placement',
	);
}
export interface DeploymentPreview {
	token: string;
	target: string;
	taleExists: boolean;
	files: {
		path: string;
		action: 'create' | 'update' | 'unchanged';
		before: string | null;
		content: string;
	}[];
	notes: string[];
}
export function requiresTaleOverwrite(preview: DeploymentPreview): boolean {
	return preview.files.some(
		(file) =>
			file.path.startsWith('.tale/') &&
			file.path.endsWith('.tale') &&
			file.action === 'update',
	);
}
export function validateAgentSelection(
	value: unknown,
): asserts value is AgentSelection[] {
	check(
		Array.isArray(value) && value.length > 0 && value.length <= agents.length,
		'Select at least one supported agent',
	);
	const seen = new Set<string>();
	for (const selected of value) {
		check(
			record(selected) &&
				typeof selected.agent === 'string' &&
				typeof selected.location === 'string',
			'Invalid agent selection',
		);
		const agent = agents.find((agent) => agent.id === selected.agent);
		check(
			agent &&
				(agent.locations as readonly string[]).includes(selected.location),
			'Unsupported agent entry point',
		);
		check(!seen.has(selected.agent), 'Duplicate agent selection');
		seen.add(selected.agent);
	}
}
export function validateDeploymentPreview(
	value: unknown,
): asserts value is DeploymentPreview {
	check(
		record(value) &&
			typeof value.token === 'string' &&
			typeof value.target === 'string' &&
			typeof value.taleExists === 'boolean',
		'Invalid deployment preview',
	);
	check(
		Array.isArray(value.files) &&
			value.files.every(
				(file) =>
					record(file) &&
					typeof file.path === 'string' &&
					['create', 'update', 'unchanged'].includes(String(file.action)) &&
					(file.before === null || typeof file.before === 'string') &&
					typeof file.content === 'string',
			),
		'Invalid deployment files',
	);
	check(
		Array.isArray(value.notes) &&
			value.notes.every((note) => typeof note === 'string'),
		'Invalid deployment notes',
	);
}
