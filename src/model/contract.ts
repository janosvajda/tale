import { check, type DiagramItem, type Project, record } from './project.js';

export const conditions = [
	'exists',
	'absent',
	'equals_file',
	'unchanged',
	'command_succeeds',
] as const;
export type Condition = (typeof conditions)[number];
export interface Requirement {
	id: string;
	action: string;
	condition: Condition;
	subject: string;
	expected: string;
	mandatory: boolean;
	checks: string[];
}
export interface ContractCheck {
	id: string;
	action: string;
	executable: string;
	arguments: string[];
	protected_files: string[];
	timeout_ms: number;
}
export interface Contract {
	requirements: Requirement[];
	checks: ContractCheck[];
}
export interface ContractIssue {
	items: string[];
	message: string;
}
export const contractLimits = { timeout: 300000, defaultTimeout: 30000 };
export function relativeFile(path: string): boolean {
	return (
		path.length > 0 &&
		!path.includes('\\') &&
		!path.includes(':') &&
		!path.includes('\0') &&
		path
			.split('/')
			.every((part) => part.length > 0 && part !== '.' && part !== '..')
	);
}
export function itemTag(project: Project, item: DiagramItem): string {
	return project.itemTypes.find((type) => type.id === item.typeId)?.tag ?? '';
}
function stringList(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.every((entry) => typeof entry === 'string' && !entry.includes('\0'))
	);
}
function requirement(project: Project, item: DiagramItem): Requirement {
	const p = item.properties;
	check(typeof p.action === 'string' && p.action.trim(), 'Choose an action');
	check(
		conditions.includes(p.condition as Condition),
		'Choose a supported condition',
	);
	check(
		typeof p.mandatory === 'boolean',
		'Choose whether this requirement is mandatory',
	);
	if (p.condition !== 'command_succeeds')
		check(
			typeof p.subject === 'string' && relativeFile(p.subject),
			'Choose a project-relative file to inspect',
		);
	if (p.condition === 'equals_file')
		check(
			typeof p.expected === 'string' && relativeFile(p.expected),
			'Choose an approved reference file',
		);
	return {
		id: item.id,
		action: p.action,
		condition: p.condition as Condition,
		subject: String(p.subject ?? ''),
		expected: String(p.expected ?? ''),
		mandatory: p.mandatory,
		checks: project.diagram.connections
			.filter((edge) => edge.from === item.id && edge.kind === 'verified_by')
			.map((edge) => edge.to)
			.sort(),
	};
}
function contractCheck(item: DiagramItem): ContractCheck {
	const p = item.properties;
	check(typeof p.action === 'string' && p.action.trim(), 'Choose an action');
	check(
		typeof p.executable === 'string' &&
			p.executable.trim() &&
			!p.executable.includes('\0'),
		'Choose an executable',
	);
	check(stringList(p.arguments), 'Arguments must be separate text entries');
	check(
		stringList(p.protected_files) &&
			p.protected_files.length > 0 &&
			p.protected_files.every(relativeFile),
		'Choose at least one project-relative test or adapter file to protect',
	);
	check(
		typeof p.timeout_ms === 'number' &&
			Number.isSafeInteger(p.timeout_ms) &&
			p.timeout_ms > 0 &&
			p.timeout_ms <= contractLimits.timeout,
		'Timeout must be between 1 and 300000 milliseconds',
	);
	return {
		id: item.id,
		action: p.action,
		executable: p.executable,
		arguments: p.arguments,
		protected_files: [...new Set(p.protected_files)].sort(),
		timeout_ms: p.timeout_ms,
	};
}
export function inspectContract(project: Project): {
	contract: Contract;
	issues: ContractIssue[];
} {
	const contract: Contract = { requirements: [], checks: [] };
	const issues: ContractIssue[] = [];
	for (const item of project.diagram.items) {
		const tag = itemTag(project, item);
		if (tag !== 'REQUIREMENT' && tag !== 'CHECK') continue;
		try {
			if (tag === 'REQUIREMENT')
				contract.requirements.push(requirement(project, item));
			else contract.checks.push(contractCheck(item));
		} catch (error) {
			issues.push({
				items: [item.id],
				message: String(error instanceof Error ? error.message : error),
			});
		}
		const roots = project.exports.map((output) => output.rootItemId);
		if (
			!project.diagram.connections.some(
				(edge) =>
					edge.to === item.id &&
					edge.kind === 'contains' &&
					roots.includes(edge.from),
			)
		)
			issues.push({
				items: [item.id],
				message: 'Connect this item to an exported Tale root',
			});
	}
	checkPolicySteps(project, contract, issues);
	checkLinks(project, contract, issues);
	checkConflicts(contract.requirements, issues);
	contract.requirements.sort((a, b) =>
		a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
	);
	contract.checks.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	return { contract, issues };
}
function checkPolicySteps(
	project: Project,
	contract: Contract,
	issues: ContractIssue[],
) {
	for (const item of project.diagram.items) {
		const tag = itemTag(project, item);
		if (
			!['PROOF', 'OVERRIDES'].includes(tag) ||
			!Array.isArray(item.properties.steps)
		)
			continue;
		for (const step of item.properties.steps) {
			const message = policyStepIssue(tag, step, contract);
			if (message) issues.push({ items: [item.id], message });
		}
	}
}
function policyStepIssue(
	tag: string,
	step: unknown,
	contract: Contract,
): string | undefined {
	if (!record(step)) return;
	const attributes = record(step.attributes) ? step.attributes : {};
	if (step.operation === 'contract_verify') {
		if (
			tag !== 'PROOF' ||
			attributes.baseline !== 'external' ||
			attributes.coverage !== 'mandatory'
		)
			return 'Contract proof requires an external baseline and mandatory coverage';
	}
	if (step.operation === 'request_change') {
		if (
			tag !== 'OVERRIDES' ||
			typeof attributes.reason !== 'string' ||
			!attributes.reason.trim() ||
			!contract.requirements.some(
				(entry) => entry.id === attributes.requirement,
			)
		)
			return 'A change request must name an existing requirement and explain the change; it never grants approval';
	}
}
function checkLinks(
	project: Project,
	contract: Contract,
	issues: ContractIssue[],
) {
	for (const edge of project.diagram.connections.filter(
		(edge) => edge.kind === 'verified_by',
	)) {
		const requirement = contract.requirements.find(
			(entry) => entry.id === edge.from,
		);
		const check = contract.checks.find((entry) => entry.id === edge.to);
		if (!requirement || !check || requirement.action !== check.action)
			issues.push({
				items: [edge.from, edge.to],
				message:
					'Verified by must connect a requirement to a check for the same action',
			});
	}
	for (const requirement of contract.requirements) {
		checkRoots(project, requirement, issues);
		if (requirement.mandatory && !requirement.checks.length)
			issues.push({
				items: [requirement.id],
				message: 'Mandatory requirement has no linked check',
			});
		if (new Set(requirement.checks).size !== requirement.checks.length)
			issues.push({
				items: [requirement.id],
				message: 'Duplicate verification link',
			});
	}
	for (const check of contract.checks) {
		if (
			!contract.requirements.some((requirement) =>
				requirement.checks.includes(check.id),
			)
		)
			issues.push({
				items: [check.id],
				message: 'Check does not verify a requirement',
			});
	}
}
function checkRoots(
	project: Project,
	requirement: Requirement,
	issues: ContractIssue[],
) {
	const roots = project.diagram.connections
		.filter((edge) => edge.kind === 'contains' && edge.to === requirement.id)
		.map((edge) => edge.from);
	for (const check of requirement.checks) {
		if (
			roots.some(
				(root) =>
					!project.diagram.connections.some(
						(edge) =>
							edge.kind === 'contains' &&
							edge.from === root &&
							edge.to === check,
					),
			)
		)
			issues.push({
				items: [requirement.id, check],
				message: 'Requirement and check must belong to the same exported Tale',
			});
	}
}
function checkConflicts(requirements: Requirement[], issues: ContractIssue[]) {
	for (const [index, a] of requirements.entries()) {
		for (const b of requirements.slice(index + 1)) {
			if (
				!a.mandatory ||
				!b.mandatory ||
				a.action !== b.action ||
				a.subject !== b.subject ||
				a.condition === 'command_succeeds' ||
				b.condition === 'command_succeeds'
			)
				continue;
			const absenceConflict =
				(a.condition === 'absent') !== (b.condition === 'absent');
			if (absenceConflict)
				issues.push({
					items: [a.id, b.id],
					message:
						'The same action requires this file to be both absent and present',
				});
		}
	}
}
export function contractFor(project: Project): Contract {
	const result = inspectContract(project);
	check(
		!result.issues.length,
		result.issues
			.map((issue) => `${issue.items.join(', ')}: ${issue.message}`)
			.join('\n'),
	);
	return result.contract;
}
