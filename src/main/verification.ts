import { randomUUID } from 'node:crypto';
import { mkdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { compile } from '../application/compiler.js';
import { contractFor } from '../model/contract.js';
import { check, type Project } from '../model/project.js';
import type {
	VerificationPreview,
	VerificationResult,
} from '../model/verification.js';
import {
	type Baseline,
	createBaseline,
	digest,
	verifyContract,
} from '../runner/verifier.js';
import { atomicWrite, existing } from './files.js';

export class VerificationSession {
	private context?: {
		project: Project;
		candidate: Baseline;
		preview: VerificationPreview;
		baseline: Baseline | null;
	};
	constructor(private store: string) {}
	async prepare(
		project: Project,
		target: string,
	): Promise<VerificationPreview> {
		this.context = undefined;
		const candidate = await createBaseline(
			target,
			project,
			'Pending human approval',
		);
		const root = await realpath(target);
		// Store is provisioned by Electron, not supplied by the renderer or project.
		await mkdir(this.store, { recursive: true });
		const store = await realpath(this.store);
		const rel = relative(root, store);
		check(
			rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel),
			'Approval storage must be outside the target project',
		);
		const path = join(store, `${digest(`${root}\n${project.id}`)}.json`);
		const source = await existing(path);
		const baseline: Baseline | null = source ? JSON.parse(source) : null;
		const approved = baseline !== null && sameAgreement(candidate, baseline);
		const preview: VerificationPreview = {
			token: randomUUID(),
			target: root,
			baselinePath: path,
			digest: digest(JSON.stringify(approved ? baseline : candidate)),
			previousDigest: baseline ? digest(JSON.stringify(baseline)) : null,
			approved,
			contract: compile(project)
				.map((artifact) => `${artifact.path}\n${artifact.content}`)
				.join('\n'),
			commands: contractFor(project).checks.map((entry) =>
				[entry.executable, ...entry.arguments]
					.map((argument) => JSON.stringify(argument))
					.join(' '),
			),
			files: candidate.protected.map((entry) => entry.path),
		};
		this.context = {
			project: structuredClone(project),
			candidate,
			preview,
			baseline,
		};
		return preview;
	}
	async approve(
		token: string,
		reason: string,
		confirm: (details: string) => Promise<boolean>,
	): Promise<VerificationPreview | null> {
		const context = this.get(token);
		check(reason.trim(), 'Explain this approval or change');
		const details = [
			`Target: ${context.preview.target}`,
			`Approval store: ${context.preview.baselinePath}`,
			`Previous approval: ${context.preview.previousDigest ?? 'None'}`,
			`Candidate: ${context.preview.digest}`,
			`Reason: ${reason}`,
			'Commands:',
			...context.preview.commands,
			'Protected test/reference files:',
			...context.preview.files,
			'These commands run with your account permissions. Keep this store and the verifier outside the coding agent’s write access.',
		].join('\n');
		if (!(await confirm(details))) return null;
		const current = await createBaseline(
			context.preview.target,
			context.project,
			reason,
		);
		check(
			sameAgreement(current, context.candidate),
			'Proof inputs changed during approval. Review again.',
		);
		const existingSource = await existing(context.preview.baselinePath);
		check(
			(existingSource
				? digest(JSON.stringify(JSON.parse(existingSource)))
				: null) === context.preview.previousDigest,
			'Approval changed on disk. Review again.',
		);
		await atomicWrite(
			context.preview.baselinePath,
			JSON.stringify(current, null, 2) + '\n',
		);
		context.baseline = current;
		context.preview = {
			...context.preview,
			approved: true,
			digest: digest(JSON.stringify(current)),
			previousDigest: digest(JSON.stringify(current)),
		};
		return context.preview;
	}
	async run(token: string): Promise<VerificationResult> {
		const context = this.get(token);
		check(
			context.preview.approved && context.baseline,
			'Approve this contract before running checks',
		);
		const source = await existing(context.preview.baselinePath);
		check(
			source &&
				digest(JSON.stringify(JSON.parse(source))) === context.preview.digest,
			'Approval changed on disk. Review again.',
		);
		return verifyContract(
			context.preview.target,
			context.project,
			context.baseline,
			context.preview.digest,
		);
	}
	private get(token: string) {
		check(
			this.context && this.context.preview.token === token,
			'Review this contract before proceeding',
		);
		return this.context;
	}
}
function sameAgreement(a: Baseline, b: Baseline): boolean {
	return (
		a.version === b.version &&
		a.target === b.target &&
		a.agreement === b.agreement &&
		JSON.stringify(a.protected) === JSON.stringify(b.protected) &&
		JSON.stringify(a.references) === JSON.stringify(b.references)
	);
}
