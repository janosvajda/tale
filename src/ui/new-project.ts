import {
	type Bridge,
	type Document,
	type Reply,
	validateReply,
} from '../model/bridge.js';
import { iconButton } from './icons.js';

const visibleTemplates = 4;

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	text?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (text !== undefined) node.textContent = text;
	return node;
}
async function response(promise: Promise<Reply>) {
	const result: unknown = await promise;
	validateReply(result);
	if (!result.ok) throw new Error(result.error);
	return result;
}
function inputField(title: string, name: string) {
	const label = el('label');
	label.className = 'field';
	const input = el('input');
	input.name = name;
	input.setAttribute('aria-label', title);
	label.append(el('span', title), input);
	return { label, input };
}
export function openNewProject(
	api: Pick<
		Bridge,
		'templates' | 'chooseDirectory' | 'newProject'
	> = window.tale,
): Promise<Document | undefined> {
	const dialog = el('dialog');
	dialog.id = 'new-project';
	dialog.setAttribute('aria-label', 'New project');
	const form = el('form');
	const header = el('div');
	header.className = 'dialog-header';
	const close = iconButton('close', 'Close new project', () => dialog.close());
	header.append(el('h2', 'New project'), close);
	const title = inputField('Project title', 'title');
	title.input.required = true;
	title.input.autofocus = true;
	title.input.placeholder = 'My project';
	const directory = inputField('Deployment directory (optional)', 'directory');
	directory.input.placeholder = 'Choose now or when you deploy';
	const directoryRow = el('div');
	directoryRow.className = 'field-row';
	const browse = iconButton('folder', 'Browse deployment directory', () => {
		void perform(async () => {
			const result = await response(
				api.chooseDirectory(directory.input.value.trim() || undefined),
			);
			if (result.directory) directory.input.value = result.directory;
		});
	});
	directoryRow.append(directory.input, browse);
	directory.label.append(directoryRow);
	const note = el(
		'small',
		'You will be asked to choose the destination again before deploying.',
	);
	const templateField = el('label');
	templateField.className = 'field';
	const templates = el('select');
	templates.name = 'template';
	templates.size = visibleTemplates;
	templates.className = 'new-project-templates';
	templates.setAttribute('aria-label', 'Tale template');
	templateField.append(el('span', 'Tale template'), templates);
	const loading = el('p', 'Loading templates…');
	templateField.append(loading);
	const error = el('p');
	error.className = 'danger';
	error.setAttribute('role', 'alert');
	const footer = el('div');
	footer.className = 'dialog-footer';
	const cancel = el('button', 'Cancel');
	cancel.type = 'button';
	cancel.addEventListener('click', () => dialog.close());
	const create = el('button', 'Create project');
	create.type = 'submit';
	create.className = 'primary';
	footer.append(cancel, create);
	form.append(
		header,
		title.label,
		directory.label,
		note,
		templateField,
		error,
		footer,
	);
	dialog.append(form);
	let busy = false;
	let result: Document | undefined;
	function selectedTemplate() {
		return templates.value;
	}
	function update() {
		for (const control of form.querySelectorAll<
			HTMLInputElement | HTMLButtonElement | HTMLSelectElement
		>('input, button, select'))
			control.disabled = busy;
		create.disabled = busy || !title.input.value.trim() || !selectedTemplate();
	}
	async function perform(task: () => Promise<void>) {
		if (busy) return;
		busy = true;
		error.textContent = '';
		update();
		try {
			await task();
		} catch (cause) {
			error.textContent =
				cause instanceof Error ? cause.message : String(cause);
		} finally {
			busy = false;
			update();
		}
	}
	form.addEventListener('input', update);
	form.addEventListener('change', update);
	form.addEventListener('submit', (event) => {
		event.preventDefault();
		const templateId = selectedTemplate();
		if (create.disabled || !templateId) return;
		void perform(async () => {
			const destination = directory.input.value.trim();
			const reply = await response(
				api.newProject({
					templateId,
					title: title.input.value.trim(),
					...(destination ? { deploymentDirectory: destination } : {}),
				}),
			);
			if (reply.cancelled) return;
			if (!reply.document) throw new Error('Missing new project');
			result = reply.document;
			dialog.close();
		});
	});
	dialog.addEventListener('cancel', (event) => {
		if (busy) event.preventDefault();
	});
	const completed = new Promise<Document | undefined>((resolve) => {
		dialog.addEventListener(
			'close',
			() => {
				dialog.remove();
				resolve(result);
			},
			{ once: true },
		);
	});
	document.body.append(dialog);
	update();
	dialog.showModal();
	void response(api.templates())
		.then((reply) => {
			if (!dialog.isConnected) return;
			loading.remove();
			if (!reply.templates?.length)
				throw new Error('No Tale templates found in templates/.');
			for (const template of reply.templates) {
				const option = el('option', template.name);
				option.value = template.id;
				templates.append(option);
			}
			templates.selectedIndex = 0;

			update();
		})
		.catch((cause) => {
			loading.remove();
			error.textContent = String(cause);
		});
	return completed;
}
