import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { compile } from '../application/compiler.js';
import {
	type ContractCheck,
	contractFor,
	type Requirement,
	relativeFile,
} from '../model/contract.js';
import { check, type Project } from '../model/project.js';
import type { VerificationResult } from '../model/verification.js';

const execution = { maxBytes: 8_000_000, logBytes: 32000 };
export interface Baseline {
	version: 1;
	target: string;
	agreement: string;
	protected: { path: string; hash: string }[];
	references: { requirement: string; bytes: string }[];
	reason: string;
}

export function digest(value: string | Buffer): string {
	return createHash('sha256').update(value).digest('hex');
}
export function agreement(project: Project): string {
	return JSON.stringify({
		artifacts: compile(project),
		contract: contractFor(project),
	});
}
export async function projectFile(
	target: string,
	path: string,
): Promise<Buffer | null> {
	check(relativeFile(path), 'Use project-relative paths without traversal');
	let current = target;
	const parts = path.split('/');
	for (const [index, part] of parts.entries()) {
		current = join(current, part);
		try {
			const stat = await lstat(current);
			check(
				!stat.isSymbolicLink(),
				`Links cannot provide verification evidence: ${path}`,
			);
			if (index < parts.length - 1)
				check(stat.isDirectory(), `Not a directory: ${path}`);
			else
				check(
					stat.isFile() && stat.size <= execution.maxBytes,
					`Evidence must be a regular file under 8 MB: ${path}`,
				);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
			throw error;
		}
	}
	return readFile(current);
}
async function requiredFile(target: string, path: string): Promise<Buffer> {
	const bytes = await projectFile(target, path);
	check(bytes, `Missing approved file: ${path}`);
	return bytes;
}
export async function createBaseline(
	target: string,
	project: Project,
	reason: string,
): Promise<Baseline> {
	check(reason.trim(), 'Record why this contract is being approved');
	const root = await realpath(target);
	const contract = contractFor(project);
	check(
		contract.requirements.some((entry) => entry.mandatory),
		'At least one mandatory requirement is needed for verification',
	);
	const baseline: Baseline = {
		version: 1,
		target: root,
		agreement: agreement(project),
		protected: [],
		references: [],
		reason,
	};
	const paths = new Set(
		contract.checks.flatMap((entry) => entry.protected_files),
	);
	for (const requirement of contract.requirements) {
		if (!requirement.checks.length) continue;
		const reference =
			requirement.condition === 'equals_file'
				? requirement.expected
				: requirement.condition === 'unchanged'
					? requirement.subject
					: null;
		if (!reference) continue;
		const bytes = await requiredFile(root, reference);
		baseline.references.push({
			requirement: requirement.id,
			bytes: bytes.toString('base64'),
		});
		if (requirement.condition === 'equals_file') paths.add(reference);
	}
	for (const path of [...paths].sort())
		baseline.protected.push({
			path,
			hash: digest(await requiredFile(root, path)),
		});
	return baseline;
}
async function preflight(project: Project, baseline: Baseline, target: string) {
	check(
		baseline.version === 1 && baseline.target === (await realpath(target)),
		'Baseline belongs to another destination',
	);
	check(
		baseline.agreement === agreement(project),
		'Agreement changed. Human approval of a new baseline is required.',
	);
	for (const file of baseline.protected)
		check(
			digest(await requiredFile(target, file.path)) === file.hash,
			`Approved test or reference changed: ${file.path}`,
		);
}
function execute(
	target: string,
	step: ContractCheck,
): Promise<{ passed: boolean; message: string }> {
	return new Promise((resolve) => {
		// No implicit shell. node uses the bundled runtime when executed inside Electron.
		const node = step.executable === 'node';
		const executable = node ? process.execPath : step.executable;
		execFile(
			executable,
			step.arguments,
			{
				cwd: target,
				windowsHide: true,
				timeout: step.timeout_ms,
				killSignal: 'SIGKILL',
				maxBuffer: execution.logBytes,
				encoding: 'utf8',
				env: { ...process.env, ...(node ? { ELECTRON_RUN_AS_NODE: '1' } : {}) },
			},
			(error, stdout, stderr) => {
				resolve({
					passed: !error,
					message: error
						? `${error.message}\n${stderr || stdout}`.slice(
								0,
								execution.logBytes,
							)
						: stdout.slice(0, execution.logBytes) ||
							'Command exited successfully',
				});
			},
		);
	});
}
async function observe(
	target: string,
	requirement: Requirement,
	baseline: Baseline,
): Promise<boolean> {
	if (requirement.condition === 'command_succeeds') return true;
	const bytes = await projectFile(target, requirement.subject);
	if (requirement.condition === 'absent') return bytes === null;
	if (requirement.condition === 'exists') return bytes !== null;
	const reference = baseline.references.find(
		(entry) => entry.requirement === requirement.id,
	);
	check(reference, `Missing approved reference for ${requirement.id}`);
	return bytes?.equals(Buffer.from(reference.bytes, 'base64')) ?? false;
}
async function evidence(
	target: string,
	requirement: Requirement,
	baseline: Baseline,
	commandPassed: boolean,
	step: string,
) {
	try {
		const passed =
			commandPassed && (await observe(target, requirement, baseline));
		return {
			passed,
			message: passed
				? 'Evidence matches the approved requirement'
				: `Failed after ${step}: ${requirement.condition} ${requirement.subject}`,
		};
	} catch (error) {
		return {
			passed: false,
			message: error instanceof Error ? error.message : String(error),
		};
	}
}
export async function verifyContract(
	target: string,
	project: Project,
	baseline: Baseline,
	pinnedDigest: string,
): Promise<VerificationResult> {
	check(
		digest(JSON.stringify(baseline)) === pinnedDigest,
		'Baseline digest does not match the trusted approval',
	);
	await preflight(project, baseline, target);
	const contract = contractFor(project);
	const result: VerificationResult = {
		passed: true,
		digest: pinnedDigest,
		checks: [],
		requirements: [],
	};
	for (const step of contract.checks) {
		await preflight(project, baseline, target);
		const command = await execute(target, step);
		result.checks.push({ id: step.id, ...command });
		// Changed proof inputs invalidate the whole run, even when a command exits zero.
		await preflight(project, baseline, target);
		for (const requirement of contract.requirements.filter((entry) =>
			entry.checks.includes(step.id),
		)) {
			const { passed, message } = await evidence(
				target,
				requirement,
				baseline,
				command.passed,
				step.id,
			);
			result.requirements.push({ id: requirement.id, passed, message });
			if (requirement.mandatory && !passed) result.passed = false;
		}
		if (!command.passed) result.passed = false;
	}
	await preflight(project, baseline, target);
	check(result.requirements.length > 0, 'No requirements were verified');
	return result;
}
