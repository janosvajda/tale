import { type Bridge, type Reply, validateReply } from '../model/bridge.js';
import {
	type AgentSelection,
	agents,
	type DeploymentPreview,
} from '../model/deployment.js';
import type { Project } from '../model/project.js';
import { iconButton } from './icons.js';

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	text?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (text !== undefined) node.textContent = text;
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
export function openDeployment(
	project: Project,
	notify: (message: string) => void,
	api: Pick<Bridge, 'prepareDeployment' | 'deploy'> = window.tale,
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
	const target = el('span', 'Choose the destination project');
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
	const preview = el('div');
	preview.className = 'deployment-preview';
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
			'Overwrite the generated .tale files shown above. Other files will be kept.',
		),
	);
	const footer = el('div');
	footer.className = 'dialog-footer';
	const cancel = el('button', 'Cancel');
	cancel.type = 'button';
	cancel.addEventListener('click', () => {
		if (!busy) dialog.close();
	});
	const deploy = el('button', 'Deploy');
	deploy.type = 'button';
	deploy.id = 'confirm-deployment';
	deploy.className = 'primary';
	deploy.disabled = true;
	footer.append(cancel, deploy);
	content.append(folder, el('h3', 'Agents'), choices, preview);
	dialog.append(header, content, confirmation, error, footer);
	let plan: DeploymentPreview | undefined;
	let busy = false;
	let hasTarget = false;
	function update() {
		deploy.disabled = busy || !plan || (plan.taleExists && !overwrite.checked);
		choose.disabled = busy;
		cancel.disabled = busy;
		close.disabled = busy;
		for (const row of rows) {
			row.enabled.disabled = busy;
			row.location.disabled = busy || !row.enabled.checked;
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
				api.prepareDeployment(project, selections(), chooseTarget),
			);
			if (result.cancelled) return;
			if (!result.deployment) throw new Error('Missing deployment preview');
			plan = result.deployment;
			hasTarget = true;
			target.textContent = plan.target;
			confirmation.hidden = !plan.taleExists;
			renderPreview(preview, plan);
		} catch (cause) {
			error.textContent =
				cause instanceof Error ? cause.message : String(cause);
		} finally {
			busy = false;
			update();
		}
	}
	choices.addEventListener('change', () => {
		plan = undefined;
		overwrite.checked = false;
		update();
		if (hasTarget) void prepare(false);
	});
	overwrite.addEventListener('change', update);
	deploy.addEventListener('click', () => {
		if (!plan || deploy.disabled) return;
		busy = true;
		update();
		void response(api.deploy(plan.token, overwrite.checked))
			.then((result) => {
				notify(result.message ?? 'Deployed');
				dialog.close();
			})
			.catch((cause) => {
				plan = undefined;
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
	dialog.addEventListener('close', () => dialog.remove());
	document.body.append(dialog);
	update();
	dialog.showModal();
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
	target.append(el('h3', 'Files'));
	for (const file of plan.files) {
		const details = el('details');
		const summary = el(
			'summary',
			`${file.action === 'create' ? 'Create' : file.action === 'update' ? 'Update' : 'Keep'} · ${file.path}`,
		);
		const content = el('pre', file.content);
		details.append(summary, content);
		target.append(details);
	}
	for (const note of plan.notes) target.append(el('p', note));
}
