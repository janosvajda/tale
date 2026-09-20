// @browser-test

import type { Json } from '../model/project.js';
import { control, ruleFields } from './fields.js';

export function run() {
	const host = document.createElement('div');
	host.hidden = true;
	document.body.append(host);
	try {
		const check = (condition: unknown, message: string) => {
			if (!condition) throw new Error(message);
		};
		let result: Json = null;
		const platforms = control(
			'PRODUCT',
			'platforms',
			['macOS', 'Windows'],
			(value) => {
				result = value;
			},
		);
		host.append(platforms);
		const linux = platforms.querySelector<HTMLInputElement>(
			'input[aria-label="Supported platforms: Linux"]',
		);
		check(linux, 'Linux checkbox exists');
		linux?.click();
		check(
			JSON.stringify(result) === '["macOS","Windows","Linux"]',
			'Checkbox updates a typed list',
		);
		check(
			!platforms.querySelector('textarea'),
			'Lists never require JSON text',
		);
		const extra = platforms.querySelector<HTMLInputElement>(
			'input[aria-label="New Supported platforms option"]',
		);
		check(extra, 'Custom platforms can be added without JSON');
		if (extra) extra.value = 'Android';
		platforms.querySelector('button')?.click();
		check(
			JSON.stringify(result) === '["macOS","Windows","Android"]',
			'Custom options remain plain strings',
		);
		const policy = control('SCOPE', 'mode', 'require_approval', (value) => {
			result = value;
		});
		host.append(policy);
		const select = policy.querySelector('select');
		check(
			select?.selectedOptions[0]?.textContent === 'Needs approval',
			'Approval choices use readable labels',
		);
		if (select) {
			select.value = 'deny';
			select.dispatchEvent(new Event('change'));
		}
		check(result === 'deny', 'Approval choice preserves its compilation token');
		const toggle = control(
			'ARCHITECTURE',
			'context_isolation',
			true,
			(value) => {
				result = value;
			},
		);
		host.append(toggle);
		toggle.querySelector<HTMLInputElement>('input')?.click();
		check(result === false, 'Switch preserves boolean type');
		const step = control(
			'PROOF',
			'steps',
			[{ operation: 'run', command: 'npm test', expect: { exit: 0 } }],
			(value) => {
				result = value;
			},
		);
		host.append(step);
		localEntryActions(step, () => result);
		const exit = step.querySelector<HTMLInputElement>(
			'input[aria-label="Exit code"]',
		);
		check(exit?.type === 'number', 'Exit code is a numeric control');
		if (exit) {
			exit.value = '2';
			exit.dispatchEvent(new Event('change'));
		}
		check(
			Array.isArray(result) &&
				(result[0] as { expect: { exit: number } }).expect.exit === 2,
			'Nested step edits retain numeric values',
		);
		check(
			!step.querySelector('textarea'),
			'Step data is edited through structured controls',
		);
		const paths = control('SCOPE', 'paths', ['src/**'], (value) => {
			result = value;
		});
		host.append(paths);
		paths.querySelector<HTMLInputElement>('input')!.value = 'docs/**';
		host.append(paths);
		paths.querySelector('input')!.dispatchEvent(new Event('change'));
		check(
			JSON.stringify(result) === '["docs/**"]',
			'Path entries are plain strings, not JSON',
		);
		const add = ruleFields(
			'PRODUCT',
			{},
			(_key, value) => {
				result = value;
			},
			() => {},
			[],
			() => {},
		);
		host.append(add);
		add.querySelector<HTMLButtonElement>('.restore-fields button')?.click();
		check(Array.isArray(result), 'Adding a list rule creates a typed list');
	} finally {
		host.remove();
	}
}

function localEntryActions(step: HTMLElement, result: () => Json) {
	step
		.querySelector<HTMLButtonElement>('[aria-label="Duplicate Step 1"]')
		?.click();
	const duplicated = result();
	if (!Array.isArray(duplicated) || duplicated.length !== 2)
		throw new Error('Duplicate step must insert one adjacent copy');
	const first = duplicated[0] as { expect: { exit: number } },
		second = duplicated[1] as { expect: { exit: number } };
	first.expect.exit = 1;
	if (second.expect.exit !== 0)
		throw new Error('Duplicated steps must be independent');
	step
		.querySelector<HTMLButtonElement>('[aria-label="Delete Step 1"]')
		?.click();
	const deleted = result();
	if (!Array.isArray(deleted) || deleted.length !== 0)
		throw new Error('Delete step must remove that entry');
	const add = step.querySelector('.list-add');
	if (!add || add !== step.querySelector('.rule-list')?.firstElementChild)
		throw new Error('Add step must appear above existing entries');
}
