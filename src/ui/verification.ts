import { type Bridge, validateReply } from '../model/bridge.js';
import { inspectContract } from '../model/contract.js';
import type { Project } from '../model/project.js';
import type {
	VerificationPreview,
	VerificationResult,
} from '../model/verification.js';
import { iconButton } from './icons.js';

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	text = '',
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	node.textContent = text;
	return node;
}
export function openVerification(
	project: Project,
	focus: (ids: string[]) => void,
	api: Pick<
		Bridge,
		'prepareVerification' | 'approveVerification' | 'runVerification'
	> = window.tale,
): void {
	if (document.querySelector('#verification')) return;
	const dialog = el('dialog');
	dialog.id = 'verification';
	dialog.setAttribute('aria-label', 'Verify agreement');
	const header = el('div');
	header.className = 'dialog-header';
	const close = iconButton('close', 'Close verification', () => {
		if (!busy) dialog.close();
	});
	header.append(el('h2', 'Verify agreement'), close);
	const content = el('div');
	content.className = 'verification-content';
	const state = el('p', 'Not verified');
	state.setAttribute('role', 'status');
	const issues = el('div');
	const review = el('div');
	const evidence = el('div');
	const reason = el('input');
	reason.placeholder = 'Reason for approving this contract or change';
	reason.setAttribute('aria-label', 'Approval reason');
	const footer = el('div');
	footer.className = 'dialog-footer';
	const choose = el('button', 'Choose project');
	choose.type = 'button';
	choose.id = 'verification-target';
	const approve = el('button', 'Approve baseline');
	approve.type = 'button';
	approve.id = 'approve-baseline';
	const run = el('button', 'Run checks');
	run.type = 'button';
	run.id = 'run-checks';
	run.className = 'primary';
	footer.append(choose, approve, run);
	const boundary = el(
		'p',
		'Approval is stored outside the project. Protect that location, its digest, and the verifier from agent writes. Commands run with your account permissions.',
	);
	boundary.className = 'small-note';
	content.append(state, issues, review, reason, evidence, boundary);
	dialog.append(header, content, footer);
	let plan: VerificationPreview | undefined;
	let busy = false;
	const inspection = inspectContract(project);
	for (const issue of inspection.issues) {
		const button = el('button', issue.message);
		button.type = 'button';
		button.className = 'contract-issue';
		button.addEventListener('click', () => {
			dialog.close();
			focus(issue.items);
		});
		issues.append(button);
	}
	if (!inspection.contract.requirements.length)
		issues.append(
			el(
				'p',
				'Add Requirement and Check items, then connect them with Verified by arrows.',
			),
		);
	const invalid =
		inspection.issues.length > 0 || !inspection.contract.requirements.length;
	function update() {
		choose.disabled = busy || invalid;
		approve.disabled = busy || !plan || plan.approved || !reason.value.trim();
		run.disabled = busy || !plan?.approved;
		close.disabled = busy;
		reason.disabled = busy;
	}
	async function perform(
		operation: () => ReturnType<Bridge['prepareVerification']>,
	) {
		busy = true;
		evidence.replaceChildren();
		state.textContent = 'Working…';
		update();
		try {
			const result = await operation();
			validateReply(result);
			if (!result.ok) throw new Error(result.error);
			if (result.cancelled) {
				state.textContent = 'Cancelled — not verified';
				return;
			}
			if (result.verification) {
				plan = result.verification;
				renderReview(review, plan);
				state.textContent = approvalLabel(plan.approved);
			}
			if (result.evidence)
				renderEvidence(project, evidence, state, result.evidence);
		} catch (error) {
			state.textContent = message(error);
			plan = undefined;
		} finally {
			busy = false;
			update();
		}
	}
	choose.addEventListener('click', () => {
		plan = undefined;
		review.replaceChildren();
		void perform(() => api.prepareVerification(project));
	});
	approve.addEventListener('click', () => {
		if (plan)
			void perform(() => api.approveVerification(plan!.token, reason.value));
	});
	run.addEventListener('click', () => {
		if (plan) void perform(() => api.runVerification(plan!.token));
	});
	reason.addEventListener('input', update);
	dialog.addEventListener('cancel', (event) => {
		if (busy) event.preventDefault();
	});
	dialog.addEventListener('close', () => dialog.remove());
	document.body.append(dialog);
	update();
	dialog.showModal();
}
function message(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}
function approvalLabel(approved: boolean) {
	return approved ? 'Approved — not yet verified' : 'Human approval required';
}
function renderEvidence(
	project: Project,
	host: HTMLElement,
	state: HTMLElement,
	result: VerificationResult,
) {
	state.textContent = result.passed
		? 'Verified for this run'
		: 'Verification failed';
	for (const entry of [...result.checks, ...result.requirements]) {
		const title =
			project.diagram.items.find((item) => item.id === entry.id)?.title ??
			entry.id;
		const row = el(
			'p',
			`${entry.passed ? '✓' : '×'} ${title}: ${entry.message}`,
		);
		row.className = entry.passed ? 'proof-pass' : 'danger';
		host.append(row);
	}
}
function renderReview(host: HTMLElement, plan: VerificationPreview) {
	host.replaceChildren(el('p', `Project: ${plan.target}`));
	const details = el('details');
	details.append(
		el('summary', 'Review contract, commands, and protected files'),
	);
	details.append(
		el(
			'pre',
			[
				plan.contract,
				'Commands:',
				...plan.commands,
				'Protected files:',
				...plan.files,
			].join('\n'),
		),
	);
	host.append(details);
	const path = el('input');
	path.readOnly = true;
	path.value = plan.baselinePath;
	path.setAttribute('aria-label', 'External approval file');
	const pin = el('input');
	pin.readOnly = true;
	pin.value = plan.digest;
	pin.setAttribute('aria-label', 'Approval digest');
	const integration = el('details');
	integration.append(el('summary', 'CI integration'));
	integration.append(
		el('p', 'External approval file'),
		path,
		el('p', 'Digest to pin in trusted CI configuration'),
		pin,
	);
	host.append(integration);
	if (plan.previousDigest && !plan.approved)
		host.append(
			el(
				'p',
				`Previous approval: ${plan.previousDigest}. This change needs a new approval.`,
			),
		);
}
