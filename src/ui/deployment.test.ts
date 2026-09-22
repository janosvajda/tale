// @browser-test
import type { Bridge, Reply } from '../model/bridge.js';
import type { DeploymentPreview } from '../model/deployment.js';
import type { Project } from '../model/project.js';
import { openDeployment } from './deployment.js';

function check(condition: unknown, message: string) {
	if (!condition) throw new Error(message);
}
function control<T extends HTMLElement>(selector: string): T {
	const element = document.querySelector<T>(`#deployment ${selector}`);
	if (!element) throw new Error(`Missing deployment control: ${selector}`);
	return element;
}
function settled() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}
async function closeDeployment() {
	const closed = new Promise((resolve) =>
		document
			.querySelector('#deployment')
			?.addEventListener('close', resolve, { once: true }),
	);
	control<HTMLButtonElement>('[aria-label="Close deployment"]').click();
	await closed;
}
export async function run(project: Project) {
	const calls: unknown[] = [];
	const preview: DeploymentPreview = {
		token: 'confirmed-preview',
		target: '/chosen/project',
		taleExists: true,
		files: [
			{
				path: '.tale/project.tale',
				action: 'update',
				before: 'Old content',
				content: '<script>inert data</script>',
			},
		],
		notes: [],
	};
	let cancelFolder = false;
	let hasRememberedTarget = false;
	let chosenTarget = false;
	let finish: ((reply: Reply) => void) | undefined;
	let progress: Parameters<Bridge['onDeploymentProgress']>[0] | undefined;
	const api: Pick<
		Bridge,
		'prepareDeployment' | 'deploy' | 'onDeploymentProgress'
	> = {
		prepareDeployment(_project, agents, chooseTarget, placement) {
			if (!chooseTarget && !hasRememberedTarget && !chosenTarget)
				return Promise.resolve({ ok: true, cancelled: true });
			if (chooseTarget && !cancelFolder) chosenTarget = true;
			calls.push({ agents, chooseTarget, placement });
			return Promise.resolve(
				cancelFolder
					? { ok: true, cancelled: true }
					: { ok: true, deployment: preview },
			);
		},
		deploy(token, overwrite) {
			calls.push({ token, overwrite });
			return new Promise((resolve) => {
				finish = resolve;
			});
		},
		onDeploymentProgress(callback) {
			progress = callback;
			return () => {
				progress = undefined;
			};
		},
	};
	const messages: string[] = [];
	try {
		openDeployment(
			{ ...project, deploymentDirectory: '/saved/suggestion' },
			(message) => messages.push(message),
			api,
		);
		await settled();
		check(
			control<HTMLElement>('.deployment-folder').textContent?.includes(
				'/saved/suggestion',
			),
			'Saved directory is shown as a suggestion',
		);
		check(
			calls.length === 0,
			'A saved directory must not automatically preview or deploy',
		);
		const deploy = control<HTMLButtonElement>('#confirm-deployment');
		check(deploy.disabled, 'Deploy needs a preview');
		control<HTMLButtonElement>('[aria-label="Choose project folder"]').click();
		await settled();
		check(deploy.disabled, 'Existing .tale needs explicit approval');
		check(
			JSON.stringify(calls[0]).includes('\"chooseTarget\":true'),
			'First preview must ask for the destination',
		);
		check(
			JSON.stringify(calls[0]).includes('placement'),
			'Preview must include the Tale reference placement',
		);
		const placement = control<HTMLSelectElement>(
			'[aria-label="Tale reference position"]',
		);
		placement.value = 'beginning';
		placement.dispatchEvent(new Event('change', { bubbles: true }));
		await settled();
		check(
			JSON.stringify(calls.at(-1)).includes('beginning'),
			'Changing placement must generate a new preview',
		);
		check(
			!document.querySelector('#deployment script'),
			'Preview content must remain inert',
		);
		const overwrite = control<HTMLInputElement>(
			'[aria-label="Overwrite existing Tale deployment"]',
		);
		overwrite.click();
		check(!deploy.disabled, 'Approval enables deployment');
		control<HTMLInputElement>('[aria-label="Claude Code"]').click();
		await settled();
		check(
			!overwrite.checked && deploy.disabled,
			'Changing agents resets approval',
		);
		overwrite.click();
		deploy.click();
		check(
			control<HTMLButtonElement>('[aria-label="Close deployment"]').disabled,
			'Keep dialog open during writes',
		);
		check(finish, 'Deployment must reach the bridge');
		progress?.({
			token: preview.token,
			completed: 1,
			total: 1,
			path: '.tale/project.tale',
		});
		check(
			control<HTMLElement>('.deployment-progress').textContent?.includes(
				'1 of 1',
			),
			'Progress shows the installed file',
		);
		finish?.({ ok: true, message: 'Deployed' });
		await settled();
		check(
			control<HTMLElement>('.deployment-progress').textContent?.includes(
				'1 file changed',
			),
			'Success keeps the change summary visible',
		);
		check(
			!control<HTMLButtonElement>('.dialog-footer button').disabled,
			'Completed deployment can close',
		);
		const completed = new Promise((resolve) =>
			document
				.querySelector('#deployment')
				?.addEventListener('close', resolve, { once: true }),
		);
		control<HTMLButtonElement>('.dialog-footer button').click();
		await completed;
		check(
			!document.querySelector('#deployment'),
			'Close ends the completed deployment',
		);
		check(messages.join() === 'Deployed', 'Success reaches the app');
		check(
			JSON.stringify(calls.at(-1)) ===
				JSON.stringify({ token: preview.token, overwrite: true }),
			'Only the preview token and explicit approval are committed',
		);
		preview.files = [
			{
				path: '.tale/project.tale',
				action: 'unchanged',
				before: 'Current Tale',
				content: 'Current Tale',
			},
		];
		openDeployment(project, () => {}, api);
		await settled();
		control<HTMLButtonElement>('[aria-label="Choose project folder"]').click();
		await settled();
		check(
			control<HTMLButtonElement>('#confirm-deployment').disabled,
			'No-change preview cannot start deployment',
		);
		check(
			control<HTMLElement>('.deployment-preview').textContent?.includes(
				'Already up to date. No files need to change.',
			),
			'No-change preview explains that nothing needs deploying',
		);
		check(
			control<HTMLElement>('.deployment-overwrite').hidden,
			'Unchanged Tale must not request overwrite',
		);
		await closeDeployment();
		preview.files.push({
			path: 'CLAUDE.md',
			action: 'create',
			before: null,
			content: 'Read the Tale',
		});
		openDeployment(project, () => {}, api);
		await settled();
		control<HTMLButtonElement>('[aria-label="Choose project folder"]').click();
		await settled();
		check(
			!control<HTMLButtonElement>('#confirm-deployment').disabled,
			'New agent instructions can deploy without Tale overwrite',
		);
		check(
			control<HTMLElement>('.deployment-overwrite').hidden,
			'New agent instructions must not request Tale overwrite',
		);
		await closeDeployment();
		hasRememberedTarget = true;
		openDeployment(project, () => {}, api);
		await settled();
		check(
			control<HTMLElement>('.deployment-folder').textContent?.includes(
				preview.target,
			),
			'Remembered destination previews without choosing a folder',
		);
		await closeDeployment();
		hasRememberedTarget = false;
		chosenTarget = false;
		cancelFolder = true;
		const before = calls.length;
		openDeployment(project, () => {}, api);
		await settled();
		control<HTMLButtonElement>('[aria-label="Choose project folder"]').click();
		await settled();
		check(
			control<HTMLButtonElement>('#confirm-deployment').disabled,
			'Cancelling folder choice cannot deploy',
		);
		const cancelled = new Promise((resolve) =>
			document
				.querySelector('#deployment')
				?.addEventListener('close', resolve, { once: true }),
		);
		control<HTMLButtonElement>('[aria-label="Close deployment"]').click();
		await cancelled;
		check(calls.length === before + 1, 'Cancelling must not commit');
	} finally {
		document.querySelector<HTMLDialogElement>('#deployment')?.close();
		document.querySelector('#deployment')?.remove();
	}
}
