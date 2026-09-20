import {
	type AgentSelection,
	type DeploymentPreview,
	validateDeploymentPreview,
} from './deployment.js';
import { check, type Project, record, validateProject } from './project.js';
import {
	type VerificationPreview,
	type VerificationResult,
	validateVerificationPreview,
	validateVerificationResult,
} from './verification.js';

export type MenuAction =
	| 'new'
	| 'open'
	| 'save'
	| 'saveAs'
	| 'deploy'
	| 'compile'
	| 'verify';
export const menuActions: MenuAction[] = [
	'new',
	'open',
	'save',
	'saveAs',
	'deploy',
	'compile',
	'verify',
];
export interface Document {
	project: Project;
	path: string | null;
}
export type Reply =
	| {
			ok: true;
			document?: Document;
			message?: string;
			cancelled?: boolean;
			deployment?: DeploymentPreview;
			verification?: VerificationPreview;
			evidence?: VerificationResult;
	  }
	| { ok: false; error: string };
export interface Bridge {
	prepareVerification(project: Project): Promise<Reply>;
	approveVerification(token: string, reason: string): Promise<Reply>;
	runVerification(token: string): Promise<Reply>;
	load(): Promise<Reply>;
	newProject(): Promise<Reply>;
	open(): Promise<Reply>;
	save(project: Project, saveAs: boolean): Promise<Reply>;
	prepareDeployment(
		project: Project,
		agents: AgentSelection[],
		chooseTarget: boolean,
	): Promise<Reply>;
	deploy(token: string, overwrite: boolean): Promise<Reply>;
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
	if (value.verification !== undefined)
		validateVerificationPreview(value.verification);
	if (value.evidence !== undefined) validateVerificationResult(value.evidence);
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
		tale: Bridge;
	}
}
