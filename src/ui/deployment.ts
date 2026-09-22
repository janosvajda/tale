import { type Bridge, type Reply, validateReply } from '../model/bridge.js';
import {
	type AgentSelection,
	agents,
	type DeploymentPreview,
	type ReferencePlacement,
	requiresTaleOverwrite,
} from '../model/deployment.js';
import type { Project } from '../model/project.js';
import { icon, iconButton } from './icons.js';

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	text?: string,
	className?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (text !== undefined) node.textContent = text;
	if (className) node.className = className;
	return node;
}
async function response(
	promise: Promise<Reply>,
): Promise<Extract<Reply, { ok: true }>> {
	const result: unknown = await promise;
	validateReply(result);
	if (!result.ok) throw new Error(result.error);
	return result;
}
function hasChanges(plan: DeploymentPreview | undefined): boolean {
	return plan?.files.some((file) => file.action !== 'unchanged') ?? false;
}
export function openDeployment(
	project: Project,
	notify: (message: string) => void,
	api: Pick<
		Bridge,
		'prepareDeployment' | 'deploy' | 'onDeploymentProgress'
	> = window.tale,
): void {
	if (document.querySelector('#deployment')) return;
	const dialog = el('dialog');
	dialog.id = 'deployment';
	dialog.setAttribute('aria-label', 'Deploy project');
	const header = el('div');
	header.className = 'dialog-header';
	const close = iconButton('close', 'Close deployment', () => {
		if (!busy) dialog.close();
	});
	header.append(el('h2', 'Deploy project'), close);
	const content = el('div');
	content.className = 'deployment-content';
	const folder = el('div');
	folder.className = 'deployment-folder';
	const target = el(
		'span',
		project.deploymentDirectory
			? `Suggested: ${project.deploymentDirectory} — choose the destination to continue`
			: 'Choose the destination project',
	);
	const choose = iconButton('folder', 'Choose project folder', () => {
		void prepare(true);
	});
	folder.append(target, choose);
	const choices = el('div');
	choices.className = 'deployment-agents';
	choices.setAttribute('role', 'group');
	choices.setAttribute('aria-label', 'Agents to support');
	const rows = agents.map((agent) => agentRow(agent));
	for (const row of rows) choices.append(row.element);
	const placementLabel = el('label');
	placementLabel.className = 'deployment-placement';
	placementLabel.append(el('span', 'New Tale reference position'));
	const placement = el('select');
	placement.setAttribute('aria-label', 'Tale reference position');
	for (const [value, label] of [
		['end', 'End'],
		['beginning', 'Beginning'],
	] as const) {
		const option = el('option', label);
		option.value = value;
		placement.append(option);
	}
	placementLabel.append(placement);
	const preview = el('div');
	preview.className = 'deployment-preview';
	const progressArea = el('div');
	progressArea.className = 'deployment-progress';
	progressArea.hidden = true;
	progressArea.setAttribute('role', 'status');
	progressArea.setAttribute('aria-live', 'polite');
	const progressText = el('strong');
	const progressBar = el('progress');
	progressArea.append(progressText, progressBar);
	const error = el('p');
	error.className = 'danger deployment-error';
	error.setAttribute('role', 'alert');
	const confirmation = el('label');
	confirmation.className = 'deployment-overwrite';
	confirmation.hidden = true;
	const overwrite = el('input');
	overwrite.type = 'checkbox';
	overwrite.setAttribute('aria-label', 'Overwrite existing Tale deployment');
	confirmation.append(
		overwrite,
		el(
			'span',
			'Replace the changed .tale file shown above. Other files will be kept.',
		),
	);
	const footer = el('div');
	footer.className = 'dialog-footer';
	const cancel = el('button', 'Cancel');
	cancel.type = 'button';
	cancel.addEventListener('click', () => {
		if (!busy) dialog.close();
	});
	const deploy = el('button');
	const deployText = el('span', 'Deploy Tale');
	deploy.append(icon('deploy'), deployText);
	deploy.type = 'button';
	deploy.id = 'confirm-deployment';
	deploy.className = 'deploy-button';
	deploy.disabled = true;
	footer.append(cancel, deploy);
	content.append(folder, el('h3', 'Agents'), choices, placementLabel, preview);
	dialog.append(header, content, confirmation, progressArea, error, footer);
	let plan: DeploymentPreview | undefined;
	let busy = false;
	let hasTarget = false;
	let deployed = false;
	function update() {
		const changes = hasChanges(plan);
		deploy.disabled =
			busy ||
			deployed ||
			!changes ||
			(!!plan && requiresTaleOverwrite(plan) && !overwrite.checked);
		deployText.textContent =
			plan && !changes ? 'Already up to date' : 'Deploy Tale';
		choose.disabled = busy || deployed;
		cancel.disabled = busy;
		close.disabled = busy;
		placement.disabled = busy || deployed;
		overwrite.disabled = busy || deployed;
		for (const row of rows) {
			row.enabled.disabled = busy || deployed;
			row.location.disabled = busy || deployed || !row.enabled.checked;
		}
	}
	function selections(): AgentSelection[] {
		return rows
			.filter((row) => row.enabled.checked)
			.map((row) => ({ agent: row.agent, location: row.location.value }));
	}
	async function prepare(chooseTarget: boolean) {
		if (busy) return;
		plan = undefined;
		overwrite.checked = false;
		confirmation.hidden = true;
		preview.replaceChildren();
		progressArea.hidden = true;
		error.textContent = '';
		if (!selections().length) {
			error.textContent = 'Select at least one agent.';
			update();
			return;
		}
		busy = true;
		update();
		try {
			const result = await response(
				api.prepareDeployment(
					project,
					selections(),
					chooseTarget,
					placement.value as ReferencePlacement,
				),
			);
			if (result.cancelled) return;
			if (!result.deployment) throw new Error('Missing deployment preview');
			plan = result.deployment;
			hasTarget = true;
			target.textContent = plan.target;
			confirmation.hidden = !requiresTaleOverwrite(plan);
			renderPreview(preview, plan);
		} catch (cause) {
			error.textContent =
				cause instanceof Error ? cause.message : String(cause);
		} finally {
			busy = false;
			update();
		}
	}
	function changed() {
		plan = undefined;
		overwrite.checked = false;
		update();
		if (hasTarget) void prepare(false);
	}
	choices.addEventListener('change', changed);
	placement.addEventListener('change', changed);
	overwrite.addEventListener('change', update);
	const stopProgress = api.onDeploymentProgress((event) => {
		if (!busy || event.token !== plan?.token) return;
		progressBar.value = event.completed;
		progressText.textContent = `Processed ${event.completed} of ${event.total}: ${event.path}`;
		for (const row of preview.querySelectorAll<HTMLElement>(
			'[data-deployment-path]',
		))
			if (row.dataset.deploymentPath === event.path)
				row.dataset.installed = 'true';
	});
	deploy.addEventListener('click', () => {
		if (!plan || deploy.disabled) return;
		busy = true;
		progressArea.hidden = false;
		progressBar.max = plan.files.length;
		progressBar.value = 0;
		progressText.textContent = `Processing 0 of ${plan.files.length} files…`;
		update();
		void response(api.deploy(plan.token, overwrite.checked))
			.then((result) => {
				notify(result.message ?? 'Deployed');
				deployed = true;
				progressBar.value = plan?.files.length ?? 0;
				const changed =
					plan?.files.filter((file) => file.action !== 'unchanged') ?? [];
				const heading = preview.querySelector('h3');
				if (heading) heading.textContent = `Files · ${changed.length} changed`;
				progressText.textContent = `Deployment complete · ${changed.length} file${changed.length === 1 ? '' : 's'} changed`;
				cancel.textContent = 'Close';
				deploy.hidden = true;
			})
			.catch((cause) => {
				plan = undefined;
				progressText.textContent = 'Deployment failed';
				error.textContent = String(cause);
			})
			.finally(() => {
				busy = false;
				update();
			});
	});
	dialog.addEventListener('cancel', (event) => {
		if (busy) event.preventDefault();
	});
	dialog.addEventListener('close', () => {
		stopProgress();
		dialog.remove();
	});
	document.body.append(dialog);
	update();
	dialog.showModal();
	void prepare(false);
}
function agentRow(agent: (typeof agents)[number]) {
	const element = el('div');
	element.className = 'deployment-agent';
	const label = el('label');
	const enabled = el('input');
	enabled.type = 'checkbox';
	enabled.checked = agent.id === 'codex';
	enabled.setAttribute('aria-label', agent.label);
	label.append(enabled, el('span', agent.label));
	const location = el('select');
	location.setAttribute('aria-label', `${agent.label} instruction file`);
	for (const path of agent.locations) {
		const option = el(
			'option',
			path === 'auto' ? 'Detect existing file' : path,
		);
		option.value = path;
		location.append(option);
	}
	element.append(label, location);
	return { element, enabled, location, agent: agent.id };
}
function renderPreview(target: HTMLElement, plan: DeploymentPreview) {
	const changed = plan.files.filter(
		(file) => file.action !== 'unchanged',
	).length;
	target.append(el('h3', `Files · ${changed} to change`));
	if (changed === 0)
		target.append(el('p', 'Already up to date. No files need to change.'));
	for (const file of plan.files) {
		const details = el('details');
		details.dataset.deploymentPath = file.path;
		const summary = el(
			'summary',
			`${file.action === 'create' ? 'Create' : file.action === 'update' ? 'Update' : 'Keep'} · ${file.path}`,
		);
		details.append(summary);
		if (file.action === 'update' && file.before !== null)
			details.append(
				el('span', 'Before', 'deployment-version'),
				el('pre', file.before),
			);
		details.append(
			el(
				'span',
				file.action === 'unchanged' ? 'Current content' : 'After',
				'deployment-version',
			),
			el('pre', file.content),
		);
		target.append(details);
	}
	for (const note of plan.notes) target.append(el('p', note));
}
