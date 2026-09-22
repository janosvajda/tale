// @browser-test
export function run() {
	const header = document.querySelector('#library-settings');
	if (!header?.textContent?.includes('Tags & skills'))
		throw new Error('Reusable notes need a clear entry point');
	if (document.querySelector('#type-list [data-type-id="skill"]'))
		throw new Error('The generic Skill must not appear');
	if (document.querySelector('#type-list [data-type-id="document"]'))
		throw new Error('The project document must not be a Tag');
	const info = document.querySelector<HTMLButtonElement>(
		'#type-list .type-info',
	);
	if (
		!info?.querySelector('svg path') ||
		!info.title.includes('Do not invent additional goals.')
	)
		throw new Error(
			'Palette Tags need a visible help icon with useful default text',
		);
	const first = document.querySelector('[data-node] .node-body');
	first?.dispatchEvent(
		new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 }),
	);
	first?.dispatchEvent(
		new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 }),
	);
	const pane = document.querySelector('#inspector');
	if (
		!pane?.querySelector('textarea[aria-label="Text"]') ||
		pane.querySelector(
			'input[type="radio"], input[type="checkbox"], .section-toolbar',
		)
	)
		throw new Error('Diagram notes need one text box and no form sections');
}
