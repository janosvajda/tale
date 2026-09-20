// @browser-test
import type { Bridge, Reply } from '../model/bridge.js';
import type { NewProjectRequest } from '../model/new-project.js';
import type { Project } from '../model/project.js';
import { openNewProject } from './new-project.js';

function check(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}
function control<T extends HTMLElement>(selector: string): T {
	const element = document.querySelector<T>(`#new-project ${selector}`);
	if (!element) throw new Error(`Missing new-project control: ${selector}`);
	return element;
}
function settled() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}
export async function run(project: Project) {
	const requests: NewProjectRequest[] = [];
	const directories: (string | undefined)[] = [];
	let cancelCreate = true;
	let templateError = false;
	let finish: ((value: Reply) => void) | undefined;
	const api: Pick<Bridge, 'templates' | 'chooseDirectory' | 'newProject'> = {
		templates: () =>
			Promise.resolve(
				templateError
					? { ok: false, error: 'Unable to read templates' }
					: {
							ok: true,
							templates: [
								{ id: 'blank.json', name: 'Blank project' },
								{ id: 'team.json', name: '<Team starter>' },
							],
						},
			),
		chooseDirectory: (initial) => {
			directories.push(initial);
			return Promise.resolve({ ok: true, cancelled: true });
		},
		newProject: (request) => {
			requests.push(request);
			return cancelCreate
				? Promise.resolve({ ok: true, cancelled: true })
				: new Promise((resolve) => {
						finish = resolve;
					});
		},
	};
	try {
		let completed = openNewProject(api);
		await settled();
		const form = control<HTMLFormElement>('form');
		const dialog = form.parentElement;
		const chromeHeight = 40;
		check(
			dialog && dialog.clientHeight <= form.scrollHeight + chromeHeight,
			'Dialog fits its form without a large empty area',
		);
		const create = control<HTMLButtonElement>('button[type="submit"]');
		check(create.disabled, 'A project needs a title');
		check(
			control<HTMLSelectElement>('select[name="template"]').value ===
				'blank.json',
			'First template selected',
		);
		check(
			!document.querySelector('#new-project team'),
			'Template names are inert text',
		);
		const title = control<HTMLInputElement>('input[name="title"]');
		title.value = '  Team rules  ';
		title.dispatchEvent(new Event('input', { bubbles: true }));
		const templates = control<HTMLSelectElement>('select[name="template"]');
		templates.value = 'team.json';
		templates.dispatchEvent(new Event('change', { bubbles: true }));
		check(
			!document.querySelector('#new-project input[type="radio"]'),
			'Templates use a list, not radio buttons',
		);
		const directory = control<HTMLInputElement>('input[name="directory"]');
		directory.value = '/future/project';
		control<HTMLButtonElement>(
			'[aria-label="Browse deployment directory"]',
		).click();
		await settled();
		check(
			directory.value === '/future/project',
			'Cancelled folder picker preserves typed path',
		);
		check(
			directories[0] === '/future/project',
			'Browse starts from the typed suggestion',
		);
		create.click();
		await settled();
		check(
			control<HTMLDialogElement>('form').isConnected,
			'Declining discard keeps the dialog open',
		);
		check(
			requests[0]?.title === 'Team rules' &&
				requests[0]?.templateId === 'team.json' &&
				requests[0]?.deploymentDirectory === '/future/project',
			'Selected title, template and directory reach main',
		);
		cancelCreate = false;
		create.click();
		check(
			create.disabled && title.disabled,
			'Pending create cannot be submitted twice',
		);
		const cancelEvent = new Event('cancel', { cancelable: true });
		document.querySelector('#new-project')?.dispatchEvent(cancelEvent);
		check(
			cancelEvent.defaultPrevented,
			'Escape waits for the pending operation',
		);
		check(finish, 'Create reached bridge');
		finish({ ok: true, document: { project, path: null } });
		check(
			(await completed)?.project === project,
			'Created document returns to the app',
		);
		completed = openNewProject(api);
		await settled();
		control<HTMLButtonElement>('[aria-label="Close new project"]').click();
		check(
			(await completed) === undefined,
			'Cancel returns no replacement document',
		);
		templateError = true;
		completed = openNewProject(api);
		await settled();
		check(
			control<HTMLElement>('[role="alert"]').textContent?.includes(
				'Unable to read templates',
			),
			'Template errors are visible',
		);
		check(
			control<HTMLButtonElement>('button[type="submit"]').disabled,
			'Missing templates cannot create a project',
		);
		control<HTMLButtonElement>('[aria-label="Close new project"]').click();
		await completed;
	} finally {
		document.querySelector<HTMLDialogElement>('#new-project')?.close();
		document.querySelector('#new-project')?.remove();
	}
}
