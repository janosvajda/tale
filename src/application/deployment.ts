import type {
	AgentSelection,
	ReferencePlacement,
} from '../model/deployment.js';
import type { Project } from '../model/project.js';
import { activateAgentFile, agentInstructions } from './agent-integration.js';
import {
	agentReference,
	hasUnmanagedTaleInstruction,
	withoutManagedReference,
} from './agent-reference.js';
import { compile } from './compiler.js';

export interface DeploymentChange {
	path: string;
	before: string | null;
	after: string;
}

export async function createDeploymentChanges(
	project: Project,
	selection: AgentSelection[],
	placement: ReferencePlacement,
	files: {
		read(path: string): Promise<string | null>;
		resolve(selected: AgentSelection): Promise<string>;
	},
): Promise<{
	changes: DeploymentChange[];
	notes: string[];
}> {
	const artifacts = compile(project);
	const selectedPaths = new Map<string, AgentSelection[]>();
	for (const selected of selection) {
		const path = await files.resolve(selected);
		selectedPaths.set(path, [...(selectedPaths.get(path) ?? []), selected]);
	}
	const changes: DeploymentChange[] = [];
	for (const artifact of artifacts)
		changes.push({
			path: artifact.path,
			before: await files.read(artifact.path),
			after: artifact.content,
		});
	const notes: string[] = [];
	for (const [path, selected] of selectedPaths) {
		const before = await files.read(path);
		const activated = activateAgentFile(path, before ?? '');
		const outputs = artifacts.map((artifact) => artifact.path);
		const unmanaged = hasUnmanagedTaleInstruction(activated, outputs);
		const after = unmanaged
			? withoutManagedReference(activated)
			: agentReference(
					activated,
					agentInstructions(path, selected, outputs, project.environments),
					placement,
				);
		if (unmanaged)
			notes.push(
				`${path} already tells the agent to read the Tale outside managed markers. Kept that instruction and removed any redundant managed block.`,
			);
		changes.push({ path, before, after });
	}
	notes.push(
		'Files are installed locally. Refresh each selected agent and verify it loaded the Tale; activation settings and nested rules can affect loading.',
	);
	return { changes, notes };
}
