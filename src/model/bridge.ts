import {
	type AgentSelection,
	type DeploymentPreview,
	type DeploymentProgress,
	type ReferencePlacement,
	validateDeploymentPreview,
} from './deployment.js';
import type { NewProjectRequest, TemplateSummary } from './new-project.js';
import {
	check,
	type Project,
	record,
	text,
	validateDirectory,
	validateProject,
} from './project.js';

export type MenuAction =
	| 'new'
	| 'open'
	| 'save'
	| 'saveAs'
	| 'deploy'
	| 'compile'
	| 'exit';
export const menuActions: MenuAction[] = [
	'new',
	'open',
	'save',
	'saveAs',
	'deploy',
	'compile',
	'exit',
];
export interface Document {
	project: Project;
	path: string | null;
}
export type Reply =
	| {
			ok: true;
			document?: Document;
			templates?: TemplateSummary[];
			recentProjects?: string[];
			directory?: string;
			message?: string;
			cancelled?: boolean;
			deployment?: DeploymentPreview;
	  }
	| { ok: false; error: string };
export interface Bridge {
	load(): Promise<Reply>;
	newProject(request: NewProjectRequest): Promise<Reply>;
	templates(): Promise<Reply>;
	chooseDirectory(initialPath?: string): Promise<Reply>;
	open(path?: string): Promise<Reply>;
	recentProjects(): Promise<Reply>;
	exit(): Promise<Reply>;
	save(project: Project, saveAs: boolean): Promise<Reply>;
	prepareDeployment(
		project: Project,
		agents: AgentSelection[],
		chooseTarget: boolean,
		placement: ReferencePlacement,
	): Promise<Reply>;
	deploy(token: string, overwrite: boolean): Promise<Reply>;
	onDeploymentProgress(
		callback: (progress: DeploymentProgress) => void,
	): () => void;
	exportTales(project: Project): Promise<Reply>;
	setDirty(dirty: boolean): Promise<Reply>;
	onMenu(callback: (action: MenuAction) => void): () => void;
}
export function validateReply(value: unknown): asserts value is Reply {
	check(
		record(value) && typeof value.ok === 'boolean',
		'Invalid application response',
	);
	if (!value.ok) {
		check(typeof value.error === 'string', 'Invalid error response');
		return;
	}
	if (value.directory !== undefined) validateDirectory(value.directory);
	if (value.recentProjects !== undefined) {
		check(
			Array.isArray(value.recentProjects) &&
				value.recentProjects.length <= 10 &&
				value.recentProjects.every(
					(path) => typeof path === 'string' && path.length > 0,
				) &&
				new Set(value.recentProjects).size === value.recentProjects.length,
			'Invalid recent projects response',
		);
	}
	if (value.templates !== undefined) {
		check(Array.isArray(value.templates), 'Invalid templates response');
		for (const entry of value.templates) {
			check(record(entry), 'Invalid template');
			text(entry.id, 'template ID');
			text(entry.name, 'template name');
		}
	}
	if (value.deployment !== undefined)
		validateDeploymentPreview(value.deployment);
	if (value.message !== undefined)
		check(typeof value.message === 'string', 'Invalid message');
	if (value.cancelled !== undefined)
		check(typeof value.cancelled === 'boolean', 'Invalid cancellation');
	if (value.document !== undefined) {
		check(
			record(value.document) &&
				(value.document.path === null ||
					typeof value.document.path === 'string'),
			'Invalid document response',
		);
		validateProject(value.document.project);
	}
}
declare global {
	interface Window {
		tale?: Bridge;
	}
}
