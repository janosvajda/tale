// @browser-test
import { inspectContract } from '../model/contract.js';
import type { Project } from '../model/project.js';
import { contractFields } from './contract-fields.js';

function check(value: unknown, message: string) {
	if (!value) throw new Error(message);
}
export function run(source: Project) {
	const project = structuredClone(source);
	const item = project.diagram.items.find(
		(item) => item.id === 'deployment-bytes',
	);
	if (!item) throw new Error('Missing requirement');
	const host = document.createElement('div');
	document.body.append(host);
	const mutate = (edit: (project: Project) => void) => {
		edit(project);
		render();
	};
	const render = () =>
		host.replaceChildren(contractFields(project, item, mutate));
	try {
		render();
		const condition = host.querySelector<HTMLSelectElement>(
			'[aria-label="Required behavior"]',
		);
		check(condition, 'Readable condition selector missing');
		check(
			!host.querySelector('textarea'),
			'Contract controls must not expose JSON',
		);
		const link = host.querySelector<HTMLInputElement>(
			'[aria-label="Verified by Exercise actual deployment"]',
		);
		check(link?.checked, 'Saved verification links must be visible');
		link?.click();
		check(
			inspectContract(project).issues.some((issue) =>
				issue.items.includes(item.id),
			),
			'Removing proof must identify the affected requirement',
		);
		host
			.querySelector<HTMLInputElement>(
				'[aria-label="Verified by Exercise actual deployment"]',
			)
			?.click();
		check(
			!inspectContract(project).issues.length,
			'Restoring the link resolves its issue',
		);
		if (condition) {
			condition.value = 'command_succeeds';
			condition.dispatchEvent(new Event('change'));
		}
		check(
			!host.querySelector('[aria-label="File to inspect"]'),
			'Command-only conditions should not ask for a file',
		);
	} finally {
		host.remove();
	}
}
