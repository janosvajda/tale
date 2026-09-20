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
				content: '<script>inert data</script>',
			},
		],
		notes: [],
	};
	let cancelFolder = false;
	let finish: ((reply: Reply) => void) | undefined;
	const api: Pick<Bridge, 'prepareDeployment' | 'deploy'> = {
		prepareDeployment(_project, agents, chooseTarget) {
			calls.push({ agents, chooseTarget });
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
	};
	const messages: string[] = [];
	try {
		openDeployment(project, (message) => messages.push(message), api);
		const deploy = control<HTMLButtonElement>('#confirm-deployment');
		check(deploy.disabled, 'Deploy needs a preview');
		control<HTMLButtonElement>('[aria-label="Choose project folder"]').click();
		await settled();
		check(deploy.disabled, 'Existing .tale needs explicit approval');
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
		const completed = new Promise((resolve) =>
			document
				.querySelector('#deployment')
				?.addEventListener('close', resolve, { once: true }),
		);
		finish?.({ ok: true, message: 'Deployed' });
		await completed;
		check(
			!document.querySelector('#deployment'),
			'Successful deployment closes dialog',
		);
		check(messages.join() === 'Deployed', 'Success reaches the app');
		check(
			JSON.stringify(calls.at(-1)) ===
				JSON.stringify({ token: preview.token, overwrite: true }),
			'Only the preview token and explicit approval are committed',
		);
		cancelFolder = true;
		const before = calls.length;
		openDeployment(project, () => {}, api);
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
