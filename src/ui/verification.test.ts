// @browser-test

import type { Bridge } from '../model/bridge.js';
import { newProject } from '../model/new-project.js';
import type { Project } from '../model/project.js';
import type { VerificationPreview } from '../model/verification.js';
import { openVerification } from './verification.js';

function check(value: unknown, message: string) {
	if (!value) throw new Error(message);
}
function control<T extends HTMLElement>(selector: string): T {
	const value = document.querySelector<T>(`#verification ${selector}`);
	if (!value) throw new Error(`Missing ${selector}`);
	return value;
}
function settled() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}
export async function run(project: Project) {
	const calls: string[] = [];
	const preview: VerificationPreview = {
		token: 'preview',
		target: '/project',
		baselinePath: '/trusted/approval',
		digest: 'pin',
		previousDigest: null,
		approved: false,
		contract: '<script>inert</script>',
		commands: ['node test.cjs'],
		files: ['test.cjs'],
	};
	const api: Pick<
		Bridge,
		'prepareVerification' | 'approveVerification' | 'runVerification'
	> = {
		prepareVerification() {
			calls.push('prepare');
			return Promise.resolve({ ok: true, verification: preview });
		},
		approveVerification(_token, reason) {
			calls.push(reason);
			return Promise.resolve({
				ok: true,
				verification: { ...preview, approved: true },
			});
		},
		runVerification() {
			calls.push('run');
			return Promise.resolve({
				ok: true,
				evidence: {
					passed: false,
					digest: 'pin',
					checks: [],
					requirements: [
						{ id: 'deployment-bytes', passed: false, message: 'Wrong output' },
					],
				},
			});
		},
	};
	try {
		openVerification(newProject(), () => {}, api);
		check(
			control('[role="status"]').textContent ===
				'No automated checks configured',
			'Empty projects explain why checks cannot run',
		);
		check(
			control<HTMLElement>('.verification-content').textContent?.includes(
				'Written rules alone',
			),
			'The purpose and limits of automated checks are explained',
		);
		check(
			getComputedStyle(control<HTMLElement>('.dialog-footer')).display ===
				'none',
			'Unconfigured checks do not show a row of disabled actions',
		);
		check(
			calls.length === 0,
			'Opening the explanation cannot execute commands',
		);
		const empty = document.querySelector<HTMLDialogElement>('#verification');
		empty?.close();
		empty?.remove();
		openVerification(project, () => {}, api);
		check(
			control<HTMLButtonElement>('#run-checks').disabled,
			'No automatic execution',
		);
		control<HTMLButtonElement>('#verification-target').click();
		await settled();
		check(
			control<HTMLButtonElement>('#run-checks').disabled,
			'Review is not approval',
		);
		check(
			!document.querySelector('#verification script'),
			'Review must render inert data',
		);
		const reason = control<HTMLInputElement>('[aria-label="Approval reason"]');
		reason.value = 'Reviewed acceptance criteria';
		reason.dispatchEvent(new Event('input'));
		control<HTMLButtonElement>('#approve-baseline').click();
		await settled();
		check(
			!control<HTMLButtonElement>('#run-checks').disabled,
			'Approved commands may run',
		);
		control<HTMLButtonElement>('#run-checks').click();
		await settled();
		check(
			control('[role="status"]').textContent === 'Verification failed',
			'Failed evidence must never look verified',
		);
		check(
			calls.join('|') === 'prepare|Reviewed acceptance criteria|run',
			'Only explicit actions reach the bridge',
		);
	} finally {
		const dialog = document.querySelector<HTMLDialogElement>('#verification');
		dialog?.close();
		dialog?.remove();
	}
}
